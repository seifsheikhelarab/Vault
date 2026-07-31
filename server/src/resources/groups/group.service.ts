import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { groups, memberships, expenses, splits, settlements, budgets, claims as claimsTable } from '../../lib/db/schema';
import type { CreateGroupInput, UpdateGroupInput } from './group.schema';

export class GroupService {
    async create(userId: string, data: CreateGroupInput) {
        const groupId = crypto.randomUUID();

        const result = await db.transaction(async (tx) => {
            const [g] = await tx
                .insert(groups)
                .values({ ...data, id: groupId, createdBy: userId })
                .returning();
            await tx.insert(memberships).values({
                id: crypto.randomUUID(),
                groupId,
                userId,
                role: 'admin'
            });
            return g;
        });

        return result;
    }

    async list(userId: string) {
        const data = await db
            .select({ group: groups })
            .from(groups)
            .innerJoin(memberships, eq(memberships.groupId, groups.id))
            .where(eq(memberships.userId, userId))
            .orderBy(desc(groups.createdAt));
        return data.map((r) => r.group);
    }

    async getById(userId: string, id: string) {
        const [membership] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, id), eq(memberships.userId, userId)));
        if (!membership) return { error: 'FORBIDDEN' as const };

        const [g] = await db.select().from(groups).where(eq(groups.id, id));
        return g ?? null;
    }

    async update(userId: string, id: string, data: UpdateGroupInput) {
        const [membership] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, id), eq(memberships.userId, userId)));
        if (!membership) return { error: 'FORBIDDEN' as const };
        if (membership.role !== 'admin') return { error: 'NOT_ADMIN' as const };

        const [updated] = await db
            .update(groups)
            .set(data)
            .where(eq(groups.id, id))
            .returning();
        return updated ?? null;
    }

    async delete(userId: string, id: string) {
        const [membership] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, id), eq(memberships.userId, userId)));
        if (!membership) return { error: 'FORBIDDEN' as const };
        if (membership.role !== 'admin') return { error: 'NOT_ADMIN' as const };

        await db.delete(groups).where(eq(groups.id, id));
        return { deleted: true };
    }

    async getBalances(userId: string, groupId: string) {
        const [membership] = await db
            .select()
            .from(memberships)
            .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)));
        if (!membership) return null;

        const groupExpenses = await db
            .select({
                expenseId: expenses.id,
                userId: expenses.userId,
                amount: expenses.amount
            })
            .from(expenses)
            .where(eq(expenses.groupId, groupId));

        const groupSplits = await db
            .select({
                expenseId: splits.expenseId,
                userId: splits.userId,
                amount: splits.amount
            })
            .from(splits)
            .innerJoin(expenses, eq(splits.expenseId, expenses.id))
            .where(eq(expenses.groupId, groupId));

        const groupSettlements = await db
            .select()
            .from(settlements)
            .where(eq(settlements.groupId, groupId));

        const net: Record<string, number> = {};

        for (const exp of groupExpenses) {
            net[exp.userId] = (net[exp.userId] ?? 0) + Number(exp.amount);
        }
        for (const s of groupSplits) {
            net[s.userId] = (net[s.userId] ?? 0) - Number(s.amount);
        }
        for (const s of groupSettlements) {
            net[s.fromUserId] = (net[s.fromUserId] ?? 0) + Number(s.amount);
            net[s.toUserId] = (net[s.toUserId] ?? 0) - Number(s.amount);
        }

        const debts: { from: string; to: string; amount: number }[] = [];
        const entries = Object.entries(net).filter(([, v]) => Math.abs(v) > 0.01);
        const debtors = entries
            .filter(([, v]) => v < 0)
            .sort((a, b) => a[1] - b[1]);
        const creditors = entries
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);

        let i = 0,
            j = 0;
        while (i < debtors.length && j < creditors.length) {
            const [dId, dAmt] = debtors[i];
            const [cId, cAmt] = creditors[j];
            const transfer = Math.min(-dAmt, cAmt);
            if (transfer > 0.01) {
                debts.push({
                    from: dId,
                    to: cId,
                    amount: Math.round(transfer * 100) / 100
                });
            }
            debtors[i] = [dId, dAmt + transfer];
            creditors[j] = [cId, cAmt - transfer];
            if (Math.abs(debtors[i][1]) < 0.01) i++;
            if (Math.abs(creditors[j][1]) < 0.01) j++;
        }

        return { net, debts };
    }

    async getCompanySummary(userId: string) {
        const userGroups = await db
            .select({ group: groups })
            .from(groups)
            .innerJoin(memberships, eq(memberships.groupId, groups.id))
            .where(and(eq(groups.kind, 'department'), eq(memberships.userId, userId)))
            .orderBy(desc(groups.createdAt));
        const departmentGroups = userGroups.map((r) => r.group);

        if (departmentGroups.length === 0) {
            return {
                departments: [],
                totalBudget: 0,
                totalSpent: 0,
                pendingClaims: 0
            };
        }

        const groupIds = departmentGroups.map((g) => g.id);

        const budgetData = await db
            .select()
            .from(budgets)
            .where(inArray(budgets.groupId, groupIds));

        const expenseData = await db
            .select()
            .from(expenses)
            .where(inArray(expenses.groupId, groupIds));

        const claimData = await db
            .select({
                id: claimsTable.id,
                status: claimsTable.status,
                expenseId: claimsTable.expenseId,
                reviewerId: claimsTable.reviewerId,
                createdAt: claimsTable.createdAt,
                expenseUserId: expenses.userId
            })
            .from(claimsTable)
            .innerJoin(expenses, eq(claimsTable.expenseId, expenses.id))
            .where(inArray(expenses.groupId, groupIds));

        const memberCounts = await db
            .select({
                groupId: memberships.groupId,
                count: sql<number>`count(*)::int`
            })
            .from(memberships)
            .where(inArray(memberships.groupId, groupIds))
            .groupBy(memberships.groupId);

        const memberCountMap = new Map(memberCounts.map((m) => [m.groupId, m.count]));

        const myMemberships = await db
            .select()
            .from(memberships)
            .where(and(inArray(memberships.groupId, groupIds), eq(memberships.userId, userId)));
        const roleMap = new Map(myMemberships.map((m) => [m.groupId, m.role]));

        const departments = departmentGroups.map((g) => {
            const deptBudgets = budgetData.filter((b) => b.groupId === g.id);
            const deptExpenses = expenseData.filter((e) => e.groupId === g.id);
            const deptClaims = claimData.filter((c) =>
                deptExpenses.some((e) => e.id === c.expenseId)
            );

            const totalBudget = deptBudgets.reduce((s, b) => s + Number(b.amount), 0);
            const totalSpent = deptExpenses.reduce((s, e) => s + Number(e.amount), 0);
            const pendingClaims = deptClaims.filter((c) => c.status === 'submitted').length;

            return {
                id: g.id,
                name: g.name,
                createdAt: g.createdAt,
                memberCount: memberCountMap.get(g.id) ?? 0,
                role: roleMap.get(g.id) ?? 'member',
                totalBudget,
                totalSpent,
                budgetUtilization:
                    totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
                pendingClaims,
                expenseCount: deptExpenses.length
            };
        });

        const totalBudget = departments.reduce((s, d) => s + d.totalBudget, 0);
        const totalSpent = departments.reduce((s, d) => s + d.totalSpent, 0);
        const pendingClaims = departments.reduce((s, d) => s + d.pendingClaims, 0);

        return { departments, totalBudget, totalSpent, pendingClaims };
    }
}
