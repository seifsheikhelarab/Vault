import type { PrismaClient } from '../../generated/prisma/client';
import { DEFAULT_TIME_ZONE, periodContaining } from '../../utils/period';
import {
    assertCategoryOwned,
    deleteOwnedOr404,
    findOwnedOr404,
    serializeAmountMinor,
} from '../../utils/ownership';
import type { CreateBudgetInput, UpdateBudgetInput } from './validation';

/**
 * Budgets service (ticket #8). All queries are scoped by userId; a missing or
 * foreign row is indistinguishable (404). Deletes are hard — budgets carry no
 * tombstone (only expenses soft-delete, for sync). Progress sums live
 * expenses inside the budget's period on the user's calendar; category
 * budgets sum only that category, overall budgets sum everything.
 */

export async function createBudget(db: PrismaClient, userId: string, input: CreateBudgetInput) {
    if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId);
    const row = await db.budget.create({
        data: {
            userId,
            periodType: input.periodType,
            amountMinor: BigInt(input.amountMinor),
            categoryId: input.categoryId ?? null,
        },
    });
    return serializeAmountMinor(row);
}

export async function listBudgets(db: PrismaClient, userId: string) {
    const rows = await db.budget.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(serializeAmountMinor);
}

export async function getBudget(db: PrismaClient, userId: string, id: string) {
    return serializeAmountMinor(await findOwnedOr404(db.budget, userId, id));
}

export async function updateBudget(
    db: PrismaClient,
    userId: string,
    id: string,
    input: UpdateBudgetInput,
) {
    await findOwnedOr404(db.budget, userId, id);
    if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId);
    const row = await db.budget.update({
        where: { id },
        data: {
            ...(input.periodType !== undefined && { periodType: input.periodType }),
            ...(input.amountMinor !== undefined && { amountMinor: BigInt(input.amountMinor) }),
            ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        },
    });
    return serializeAmountMinor(row);
}

export async function deleteBudget(db: PrismaClient, userId: string, id: string): Promise<void> {
    await deleteOwnedOr404(db.budget, userId, id);
}

async function sumSpent(
    db: PrismaClient,
    userId: string,
    start: Date,
    end: Date,
    categoryId: string | null,
): Promise<number> {
    const agg = await db.expense.aggregate({
        _sum: { amountMinor: true },
        where: {
            userId,
            deletedAt: null,
            occurredAt: { gte: start, lt: end },
            ...(categoryId !== null && { categoryId }),
        },
    });
    return Number(agg._sum.amountMinor ?? 0n);
}

export type BudgetProgress = {
    id: string;
    periodType: 'week' | 'month';
    categoryId: string | null;
    spent: number;
    limit: number;
    pct: number;
};

/**
 * Per-budget spent-vs-limit within the period containing `date` (default
 * now), bounded on the user's timeZone calendar. pct = spent / limit * 100,
 * two decimal places.
 */
export async function getBudgetProgress(
    db: PrismaClient,
    userId: string,
    date?: string,
): Promise<BudgetProgress[]> {
    const [user, budgets] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { timeZone: true } }),
        db.budget.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
    ]);
    const now = date ? new Date(date) : new Date();
    const timeZone = user?.timeZone ?? DEFAULT_TIME_ZONE;

    return Promise.all(
        budgets.map(async (budget) => {
            const { start, end } = periodContaining(budget.periodType, now, timeZone);
            const spent = await sumSpent(db, userId, start, end, budget.categoryId);
            const limit = Number(budget.amountMinor);
            return {
                id: budget.id,
                periodType: budget.periodType,
                categoryId: budget.categoryId,
                spent,
                limit,
                pct: Math.round((spent / limit) * 10000) / 100,
            };
        }),
    );
}
