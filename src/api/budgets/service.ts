import { HTTPException } from 'hono/http-exception'
import type { PrismaClient } from '../../generated/prisma/client'
import { DEFAULT_TIME_ZONE, periodContaining } from '../../utils/period'
import type { CreateBudgetInput, UpdateBudgetInput } from './validation'

/**
 * Budgets service (ticket #8). All queries are scoped by userId; a missing or
 * foreign row is indistinguishable (404). Deletes are hard — budgets carry no
 * tombstone (only expenses soft-delete, for sync). Progress sums live
 * expenses inside the budget's period on the user's calendar; category
 * budgets sum only that category, overall budgets sum everything.
 */

type BudgetRow = Awaited<ReturnType<PrismaClient['budget']['findFirst']>>

/** Prisma returns BigInt; JSON.stringify throws on it. Downsize while lossless. */
function serialize(row: NonNullable<BudgetRow>) {
  return { ...row, amountMinor: Number(row.amountMinor) }
}

async function assertCategoryOwned(
  db: PrismaClient,
  userId: string,
  categoryId: string,
): Promise<void> {
  const category = await db.category.findFirst({ where: { id: categoryId, userId } })
  if (!category) throw new HTTPException(404)
}

export async function createBudget(
  db: PrismaClient,
  userId: string,
  input: CreateBudgetInput,
) {
  if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId)
  const row = await db.budget.create({
    data: {
      userId,
      periodType: input.periodType,
      amountMinor: BigInt(input.amountMinor),
      categoryId: input.categoryId ?? null,
    },
  })
  return serialize(row)
}

export async function listBudgets(db: PrismaClient, userId: string) {
  const rows = await db.budget.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  return rows.map(serialize)
}

async function findOwned(db: PrismaClient, userId: string, id: string) {
  const budget = await db.budget.findFirst({ where: { id, userId } })
  if (!budget) throw new HTTPException(404)
  return budget
}

export async function getBudget(db: PrismaClient, userId: string, id: string) {
  return serialize(await findOwned(db, userId, id))
}

export async function updateBudget(
  db: PrismaClient,
  userId: string,
  id: string,
  input: UpdateBudgetInput,
) {
  await findOwned(db, userId, id)
  if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId)
  const row = await db.budget.update({
    where: { id },
    data: {
      ...(input.periodType !== undefined && { periodType: input.periodType }),
      ...(input.amountMinor !== undefined && { amountMinor: BigInt(input.amountMinor) }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
    },
  })
  return serialize(row)
}

export async function deleteBudget(db: PrismaClient, userId: string, id: string): Promise<void> {
  const result = await db.budget.deleteMany({ where: { id, userId } })
  if (result.count === 0) throw new HTTPException(404)
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
  })
  return Number(agg._sum.amountMinor ?? 0n)
}

export type BudgetProgress = {
  id: string
  periodType: 'week' | 'month'
  categoryId: string | null
  spent: number
  limit: number
  pct: number
}

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
  ])
  const now = date ? new Date(date) : new Date()
  const timeZone = user?.timeZone ?? DEFAULT_TIME_ZONE

  return Promise.all(
    budgets.map(async (budget) => {
      const { start, end } = periodContaining(budget.periodType, now, timeZone)
      const spent = await sumSpent(db, userId, start, end, budget.categoryId)
      const limit = Number(budget.amountMinor)
      return {
        id: budget.id,
        periodType: budget.periodType,
        categoryId: budget.categoryId,
        spent,
        limit,
        pct: Math.round((spent / limit) * 10000) / 100,
      }
    }),
  )
}
