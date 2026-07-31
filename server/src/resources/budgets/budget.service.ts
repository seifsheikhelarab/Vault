import { eq, desc } from 'drizzle-orm';
import { db } from '../../lib/db';
import { budgets } from '../../lib/db/schema';
import type { CreateBudgetInput, UpdateBudgetInput } from './budget.schema';

export class BudgetService {
    async create(userId: string, data: CreateBudgetInput) {
        const id = crypto.randomUUID();
        const [b] = await db
            .insert(budgets)
            .values({ ...data, amount: String(data.amount), id, userId })
            .returning();
        return b;
    }

    // Note: userId is accepted for API consistency with other services but
    // budgets are currently not scoped per-user in list queries.
    async list(_userId: string) {
        const data = await db
            .select()
            .from(budgets)
            .orderBy(desc(budgets.createdAt));
        return data;
    }

    async update(id: string, data: UpdateBudgetInput) {
        const updateData: Record<string, unknown> = { ...data };
        if (data.amount !== undefined) updateData.amount = String(data.amount);

        const [b] = await db
            .update(budgets)
            .set(updateData)
            .where(eq(budgets.id, id))
            .returning();
        return b ?? null;
    }

    async delete(id: string) {
        const [b] = await db
            .delete(budgets)
            .where(eq(budgets.id, id))
            .returning();
        return b ?? null;
    }
}
