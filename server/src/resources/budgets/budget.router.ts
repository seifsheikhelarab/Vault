import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';
import { ok, fail } from '../../lib/response';
import { db } from '../../lib/db';
import { budgets } from '../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { AppEnv } from '../../lib/middleware';

const createBudgetSchema = z.object({
    categoryId: z.string().min(1),
    amount: z.number().positive(),
    period: z.enum(['monthly', 'weekly', 'yearly']).default('monthly'),
    groupId: z.string().optional()
});

const updateBudgetSchema = z.object({
    amount: z.number().positive().optional(),
    period: z.enum(['monthly', 'weekly', 'yearly']).optional()
});

const budget = new Hono<AppEnv>();

budget.post('/', zValidator('json', createBudgetSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const id = crypto.randomUUID();
    const [b] = await db
        .insert(budgets)
        .values({ ...body, amount: String(body.amount), id, userId })
        .returning();
    return c.json(ok(b), 201);
});

budget.get('/', async (c) => {
    const userId = c.get('userId');
    const data = await db
        .select()
        .from(budgets)
        .orderBy(desc(budgets.createdAt));
    return c.json(ok(data));
});

budget.patch('/:id', zValidator('json', updateBudgetSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const updateData: Record<string, unknown> = { ...body };
    if (body.amount !== undefined) updateData.amount = String(body.amount);

    const [b] = await db
        .update(budgets)
        .set(updateData)
        .where(eq(budgets.id, id))
        .returning();
    if (!b) return c.json(fail('NOT_FOUND', 'Budget not found'), 404);
    return c.json(ok(b));
});

budget.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [b] = await db.delete(budgets).where(eq(budgets.id, id)).returning();
    if (!b) return c.json(fail('NOT_FOUND', 'Budget not found'), 404);
    return c.json(ok({ deleted: true }));
});

export default budget;
