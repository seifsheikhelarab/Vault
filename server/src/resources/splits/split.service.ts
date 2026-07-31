import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { splits, expenses } from '../../lib/db/schema';
import type { CreateSplitInput, SplitQueryInput } from './split.schema';

export class SplitService {
    async create(userId: string, data: CreateSplitInput) {
        const [expense] = await db
            .select()
            .from(expenses)
            .where(eq(expenses.id, data.expenseId));
        if (!expense) return { error: 'NOT_FOUND' as const };
        if (expense.userId !== userId) return { error: 'FORBIDDEN' as const };

        await db.delete(splits).where(eq(splits.expenseId, data.expenseId));

        const total = data.splits.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(total - Number(expense.amount)) > 0.01) {
            return { error: 'BAD_REQUEST' as const, message: 'Splits must equal expense amount' };
        }

        const rows = data.splits.map((s) => ({
            id: crypto.randomUUID(),
            expenseId: data.expenseId,
            userId: s.userId,
            amount: String(s.amount)
        }));

        const created = await db.insert(splits).values(rows).returning();
        return created;
    }

    async list(query: SplitQueryInput) {
        const { expenseId, groupId, userId } = query;

        if (expenseId) {
            const data = await db
                .select()
                .from(splits)
                .where(eq(splits.expenseId, expenseId))
                .orderBy(desc(splits.createdAt));
            return data;
        }

        const conditions = [];
        if (groupId) conditions.push(eq(expenses.groupId, groupId));
        if (userId) conditions.push(eq(splits.userId, userId));

        const expenseRows = await db
            .select({ id: expenses.id })
            .from(expenses)
            .where(conditions.length ? and(...conditions) : undefined);
        const expenseIds = expenseRows.map((e) => e.id);

        if (expenseIds.length === 0) return [];

        const data = await db
            .select()
            .from(splits)
            .where(inArray(splits.expenseId, expenseIds))
            .orderBy(desc(splits.createdAt));
        return data;
    }

    async deleteByExpense(userId: string, expenseId: string) {
        const [expense] = await db
            .select()
            .from(expenses)
            .where(eq(expenses.id, expenseId));
        if (!expense) return { error: 'NOT_FOUND' as const };
        if (expense.userId !== userId) return { error: 'FORBIDDEN' as const };

        await db.delete(splits).where(eq(splits.expenseId, expenseId));
        return { deleted: true };
    }
}
