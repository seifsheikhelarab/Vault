import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ok, fail } from '../../lib/response';
import { db } from '../../lib/db';
import { splits, expenses } from '../../lib/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import type { AppEnv } from '../../lib/middleware';
import { createSplitSchema, splitQuerySchema } from './split.schema';

const split = new Hono<AppEnv>();

// Create splits for an expense (replaces existing splits)
split.post('/', zValidator('json', createSplitSchema), async (c) => {
    const userId = c.get('userId');
    const { expenseId, splits: splitData } = c.req.valid('json');

    const [expense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId));
    if (!expense) return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
    if (expense.userId !== userId)
        return c.json(fail('FORBIDDEN', 'Not your expense'), 403);

    await db.delete(splits).where(eq(splits.expenseId, expenseId));

    const total = splitData.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(total - Number(expense.amount)) > 0.01) {
        return c.json(
            fail('BAD_REQUEST', 'Splits must equal expense amount'),
            400
        );
    }

    const rows = splitData.map((s) => ({
        id: crypto.randomUUID(),
        expenseId,
        userId: s.userId,
        amount: String(s.amount)
    }));

    const created = await db.insert(splits).values(rows).returning();
    return c.json(ok(created), 201);
});

// List splits
split.get('/', zValidator('query', splitQuerySchema), async (c) => {
    const { expenseId, groupId, userId: filterUserId } = c.req.valid('query');

    if (expenseId) {
        const data = await db
            .select()
            .from(splits)
            .where(eq(splits.expenseId, expenseId))
            .orderBy(desc(splits.createdAt));
        return c.json(ok(data));
    }

    // Filter by groupId or userId — need to join through expenses
    const conditions = [];
    if (groupId) conditions.push(eq(expenses.groupId, groupId));
    if (filterUserId) conditions.push(eq(splits.userId, filterUserId));

    const expenseRows = await db
        .select({ id: expenses.id })
        .from(expenses)
        .where(conditions.length ? and(...conditions) : undefined);
    const expenseIds = expenseRows.map((e) => e.id);

    if (expenseIds.length === 0) return c.json(ok([]));

    const data = await db
        .select()
        .from(splits)
        .where(inArray(splits.expenseId, expenseIds))
        .orderBy(desc(splits.createdAt));
    return c.json(ok(data));
});

// Delete splits for an expense
split.delete('/', async (c) => {
    const userId = c.get('userId');
    const expenseId = c.req.query('expenseId');
    if (!expenseId)
        return c.json(fail('BAD_REQUEST', 'expenseId required'), 400);

    const [expense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId));
    if (!expense) return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
    if (expense.userId !== userId)
        return c.json(fail('FORBIDDEN', 'Not your expense'), 403);

    await db.delete(splits).where(eq(splits.expenseId, expenseId));
    return c.json(ok({ deleted: true }));
});

export default split;
