import type { PrismaClient } from '../../generated/prisma/client'
import { DEFAULT_TIME_ZONE, periodContaining, type Period, type PeriodType } from '../../utils/period'

/**
 * Reports service (ticket #10). Weekly/monthly totals with per-category
 * breakdown plus previous-period delta, bounded on the user's calendar via
 * utils/period.ts (story #29). Tombstoned expenses are excluded everywhere
 * (deletedAt null). Clock convention: callers pass an explicit `date`
 * (undefined = real now); no hidden clock reads.
 *
 * Uncategorized expenses count toward `total` but have no row in
 * `byCategory` — the breakdown shape requires a category name, and there is
 * nothing to name a null bucket by.
 */

export interface CategorySlice {
  categoryId: string
  name: string
  total: number
}

export interface ReportResult {
  period: Period
  total: number
  byCategory: CategorySlice[]
  previous: { total: number; delta: number; deltaPct: number | null }
}

const round2 = (value: number): number => Math.round(value * 100) / 100

export async function getReport(
  db: PrismaClient,
  userId: string,
  periodType: PeriodType,
  date?: string,
): Promise<ReportResult> {
  const [user, now] = [
    await db.user.findUnique({ where: { id: userId }, select: { timeZone: true } }),
    date ? new Date(date) : new Date(),
  ]
  const timeZone = user?.timeZone ?? DEFAULT_TIME_ZONE

  const period = periodContaining(periodType, now, timeZone)
  // One millisecond before this period's start lands in the previous one;
  // recomputing boundaries there stays correct across DST shifts.
  const prevPeriod = periodContaining(periodType, new Date(period.start.getTime() - 1), timeZone)

  const window = (p: Period) => ({
    userId,
    deletedAt: null,
    occurredAt: { gte: p.start, lt: p.end },
  })

  const [grouped, prevAgg] = await Promise.all([
    db.expense.groupBy({
      by: ['categoryId'],
      _sum: { amountMinor: true },
      where: window(period),
    }),
    db.expense.aggregate({
      _sum: { amountMinor: true },
      where: window(prevPeriod),
    }),
  ])

  const total = grouped.reduce((sum, row) => sum + Number(row._sum.amountMinor ?? 0n), 0)
  const prevTotal = Number(prevAgg._sum.amountMinor ?? 0n)

  const categorizedIds = grouped
    .map((row) => row.categoryId)
    .filter((id): id is string => id !== null)
  const categories = categorizedIds.length
    ? await db.category.findMany({
        where: { userId, id: { in: categorizedIds } },
        select: { id: true, name: true },
      })
    : []
  const names = new Map(categories.map((c) => [c.id, c.name]))

  const byCategory = grouped
    .filter((row): row is typeof row & { categoryId: string } => row.categoryId !== null)
    .map((row) => ({
      categoryId: row.categoryId,
      name: names.get(row.categoryId) ?? '',
      total: Number(row._sum.amountMinor ?? 0n),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  return {
    period,
    total,
    byCategory,
    previous: {
      total: prevTotal,
      delta: total - prevTotal,
      deltaPct:
        prevTotal === 0 ? null : round2(((total - prevTotal) / prevTotal) * 100),
    },
  }
}
