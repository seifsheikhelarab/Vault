import { eq, and, desc, inArray, type SQL } from 'drizzle-orm';
import { db } from '../../lib/db';
import { claims, expenses, groups, memberships } from '../../lib/db/schema';
import type {
    CreateClaimInput,
    ClaimQueryInput,
    RejectClaimInput
} from './claim.schema';

export class ClaimService {
    async create(userId: string, data: CreateClaimInput) {
        const [expense] = await db
            .select()
            .from(expenses)
            .where(eq(expenses.id, data.expenseId));
        if (!expense) return { error: 'NOT_FOUND' as const };
        if (expense.userId !== userId) return { error: 'FORBIDDEN' as const };

        const [existing] = await db
            .select()
            .from(claims)
            .where(eq(claims.expenseId, data.expenseId));
        if (existing) return { error: 'CONFLICT' as const };

        const id = crypto.randomUUID();
        const [cl] = await db
            .insert(claims)
            .values({ id, expenseId: data.expenseId })
            .returning();
        return cl;
    }

    async list(userId: string, query: ClaimQueryInput) {
        let allowedGroupIds: string[];

        if (query.groupId) {
            const [membership] = await db
                .select()
                .from(memberships)
                .where(
                    and(
                        eq(memberships.groupId, query.groupId),
                        eq(memberships.userId, userId)
                    )
                );
            if (!membership) return { error: 'FORBIDDEN' as const };
            allowedGroupIds = [query.groupId];
        } else {
            const userGroups = await db
                .select({ id: groups.id })
                .from(groups)
                .innerJoin(memberships, eq(memberships.groupId, groups.id))
                .where(
                    and(
                        eq(groups.kind, 'department'),
                        eq(memberships.userId, userId)
                    )
                );
            allowedGroupIds = userGroups.map((g) => g.id);
        }

        if (allowedGroupIds.length === 0) return [];

        let expenseFilter: SQL<unknown> = inArray(expenses.groupId, allowedGroupIds);
        if (query.userId) {
            expenseFilter = and(
                expenseFilter,
                eq(expenses.userId, query.userId)
            ) as SQL<unknown>;
        }

        const groupExpenses = await db
            .select({ id: expenses.id })
            .from(expenses)
            .where(expenseFilter);
        const expenseIds = groupExpenses.map((e) => e.id);
        if (expenseIds.length === 0) return [];

        const claimConditions = [inArray(claims.expenseId, expenseIds)];
        if (query.status) {
            claimConditions.push(eq(claims.status, query.status));
        }

        const data = await db
            .select({
                id: claims.id,
                expenseId: claims.expenseId,
                status: claims.status,
                reviewerId: claims.reviewerId,
                reviewNote: claims.reviewNote,
                reviewedAt: claims.reviewedAt,
                createdAt: claims.createdAt,
                updatedAt: claims.updatedAt,
                expense: {
                    id: expenses.id,
                    amount: expenses.amount,
                    description: expenses.description,
                    date: expenses.date,
                    userId: expenses.userId,
                    categoryId: expenses.categoryId,
                    groupId: expenses.groupId,
                    receiptUrl: expenses.receiptUrl,
                    scope: expenses.scope
                }
            })
            .from(claims)
            .innerJoin(expenses, eq(claims.expenseId, expenses.id))
            .where(and(...claimConditions))
            .orderBy(desc(claims.createdAt));

        return data;
    }

    async approve(userId: string, id: string) {
        const [cl] = await db
            .update(claims)
            .set({
                status: 'approved',
                reviewerId: userId,
                reviewedAt: new Date()
            })
            .where(eq(claims.id, id))
            .returning();
        return cl ?? null;
    }

    async reject(userId: string, id: string, data: RejectClaimInput) {
        const [cl] = await db
            .update(claims)
            .set({
                status: 'rejected',
                reviewerId: userId,
                reviewNote: data.note ?? null,
                reviewedAt: new Date()
            })
            .where(eq(claims.id, id))
            .returning();
        return cl ?? null;
    }

    async reimburse(userId: string, id: string) {
        const [cl] = await db
            .update(claims)
            .set({
                status: 'reimbursed',
                reviewerId: userId,
                reviewedAt: new Date()
            })
            .where(eq(claims.id, id))
            .returning();
        return cl ?? null;
    }
}
