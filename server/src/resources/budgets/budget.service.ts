import { desc, eq, or, isNull } from 'drizzle-orm';
import { db } from '../../lib/db';
import { budgets } from '../../lib/db/schema';
import type { CreateBudgetInput, UpdateBudgetInput } from './budget.schema';

export class BudgetService {
    async create(userId: string, data: CreateBudgetInput) {
        const id = crypto.randomUUID();
        const [budget] = await db
            .insert(budgets)
            .values({
                id,
                categoryId: data.categoryId,
                amountCents: data.amountCents,
                period: data.period ?? 'monthly',
                userId,
                groupId: data.groupId ?? null
            })
            .returning();
        return budget;
    }

    async list(userId: string) {
        return db
            .select()
            .from(budgets)
            .where(or(eq(budgets.userId, userId), isNull(budgets.userId)))
            .orderBy(desc(budgets.createdAt));
    }

    async update(id: string, data: UpdateBudgetInput) {
        const updates: Record<string, unknown> = {};
        if (data.amountCents !== undefined)
            updates.amountCents = data.amountCents;
        if (data.period !== undefined) updates.period = data.period;

        const [budget] = await db
            .update(budgets)
            .set(updates)
            .where(eq(budgets.id, id))
            .returning();
        return budget ?? null;
    }

    async delete(id: string) {
        const [budget] = await db
            .delete(budgets)
            .where(eq(budgets.id, id))
            .returning();
        return budget ?? null;
    }
}
