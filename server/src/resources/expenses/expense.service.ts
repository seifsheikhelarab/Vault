import { eq, and, gte, lte, sql, desc, type SQL } from 'drizzle-orm';
import { db } from '../../lib/db';
import { expenses } from '../../lib/db/schema';
import type {
    CreateExpenseInput,
    UpdateExpenseInput,
    ExpenseQueryInput
} from './expense.schema';

export class ExpenseService {
    async create(userId: string, data: CreateExpenseInput) {
        const id = crypto.randomUUID();
        const [expense] = await db
            .insert(expenses)
            .values({ ...data, amount: String(data.amount), id, userId })
            .returning();
        return expense;
    }

    async list(userId: string, query: ExpenseQueryInput) {
        const { page, pageSize, categoryId, scope, groupId, from, to } = query;
        const conditions: SQL<unknown>[] = [];

        // If groupId is specified, show all expenses in that group (membership check done in controller)
        if (groupId) {
            conditions.push(eq(expenses.groupId, groupId));
        } else {
            // Otherwise, only show the user's own expenses
            conditions.push(eq(expenses.userId, userId));
        }

        if (categoryId) conditions.push(eq(expenses.categoryId, categoryId));
        if (scope) conditions.push(eq(expenses.scope, scope));
        if (from) conditions.push(gte(expenses.date, new Date(from)));
        if (to) conditions.push(lte(expenses.date, new Date(to)));

        const where = and(...conditions);

        const [countResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(expenses)
            .where(where);

        const items = await db
            .select()
            .from(expenses)
            .where(where)
            .orderBy(desc(expenses.date))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        return {
            items,
            total: countResult?.count ?? 0,
            page,
            pageSize
        };
    }

    async getById(userId: string, id: string) {
        const [expense] = await db
            .select()
            .from(expenses)
            .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
        return expense ?? null;
    }

    async update(userId: string, id: string, data: UpdateExpenseInput) {
        const updateData: Record<string, unknown> = { ...data };
        if (data.amount !== undefined) updateData.amount = String(data.amount);
        const [expense] = await db
            .update(expenses)
            .set(updateData)
            .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
            .returning();
        return expense ?? null;
    }

    async delete(userId: string, id: string) {
        const [expense] = await db
            .delete(expenses)
            .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
            .returning();
        return expense ?? null;
    }
}
