import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';
import { ok, fail } from '../../lib/response';
import { db } from '../../lib/db';
import {
    claims,
    expenses,
    categories,
    groups,
    memberships
} from '../../lib/db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import type { AppEnv } from '../../lib/middleware';

const createClaimSchema = z.object({
    expenseId: z.string().min(1)
});

const claimQuerySchema = z.object({
    groupId: z.string().optional(),
    userId: z.string().optional(),
    status: z
        .enum(['submitted', 'approved', 'rejected', 'reimbursed'])
        .optional()
});

const rejectClaimSchema = z.object({
    note: z.string().max(500).optional()
});

const claim = new Hono<AppEnv>();

claim.post('/', zValidator('json', createClaimSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');

    // Verify the expense exists and belongs to user or user is admin of the group
    const [expense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, body.expenseId));
    if (!expense) return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
    if (expense.userId !== userId)
        return c.json(fail('FORBIDDEN', 'Not your expense'), 403);

    // Check if already claimed
    const [existing] = await db
        .select()
        .from(claims)
        .where(eq(claims.expenseId, body.expenseId));
    if (existing)
        return c.json(fail('CONFLICT', 'Expense already has a claim'), 409);

    const id = crypto.randomUUID();
    const [cl] = await db
        .insert(claims)
        .values({ id, expenseId: body.expenseId })
        .returning();
    return c.json(ok(cl), 201);
});

claim.get('/', zValidator('query', claimQuerySchema), async (c) => {
    const userId = c.get('userId');
    const query = c.req.valid('query');

    // If groupId is specified, verify membership
    let allowedGroupIds: string[] | null = null;

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
        if (!membership)
            return c.json(fail('FORBIDDEN', 'Not a member of this group'), 403);
        allowedGroupIds = [query.groupId];
    } else {
        // Get all department groups the user belongs to
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

    if (allowedGroupIds.length === 0) return c.json(ok([]));

    // Get expenses in those groups
    let expenseFilter = inArray(expenses.groupId, allowedGroupIds!);

    // If userId is specified, filter by that user
    if (query.userId) {
        expenseFilter = and(
            expenseFilter,
            eq(expenses.userId, query.userId)
        ) as any;
    }

    const groupExpenses = await db
        .select({ id: expenses.id })
        .from(expenses)
        .where(expenseFilter);
    const expenseIds = groupExpenses.map((e) => e.id);
    if (expenseIds.length === 0) return c.json(ok([]));

    // Build claim filter
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

    return c.json(ok(data));
});

claim.patch('/:id/approve', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const [cl] = await db
        .update(claims)
        .set({ status: 'approved', reviewerId: userId, reviewedAt: new Date() })
        .where(eq(claims.id, id))
        .returning();
    if (!cl) return c.json(fail('NOT_FOUND', 'Claim not found'), 404);
    return c.json(ok(cl));
});

claim.patch('/:id/reject', zValidator('json', rejectClaimSchema), async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const [cl] = await db
        .update(claims)
        .set({
            status: 'rejected',
            reviewerId: userId,
            reviewNote: body.note ?? null,
            reviewedAt: new Date()
        })
        .where(eq(claims.id, id))
        .returning();
    if (!cl) return c.json(fail('NOT_FOUND', 'Claim not found'), 404);
    return c.json(ok(cl));
});

claim.patch('/:id/reimburse', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const [cl] = await db
        .update(claims)
        .set({
            status: 'reimbursed',
            reviewerId: userId,
            reviewedAt: new Date()
        })
        .where(eq(claims.id, id))
        .returning();
    if (!cl) return c.json(fail('NOT_FOUND', 'Claim not found'), 404);
    return c.json(ok(cl));
});

export default claim;
