import type { PrismaClient } from '../../generated/prisma/client'
import { getBudgetProgress, type BudgetProgress } from '../budgets/service'
import { listExpenses } from '../expenses/service'
import { getReport } from '../reports/service'

/**
 * Dashboard service (ticket #11). Composition only: every number comes from
 * an existing service — reports for period totals and previous-period deltas,
 * budgets for spent-vs-limit progress, expenses for the recent list. No
 * aggregation logic lives here. Clock convention matches those services:
 * callers pass an explicit `date` (undefined = real now).
 */

export interface PeriodSummary {
  total: number
  previous: { total: number; delta: number; deltaPct: number | null }
}

export interface RecentExpense {
  id: string
  amountMinor: number
  currency: string
  categoryId: string | null
  occurredAt: Date
  note: string | null
}

export interface DashboardSnapshot {
  month: PeriodSummary
  week: PeriodSummary
  budgets: BudgetProgress[]
  recentExpenses: RecentExpense[]
}

const RECENT_LIMIT = 5

export async function getDashboard(
  db: PrismaClient,
  userId: string,
  date?: string,
): Promise<DashboardSnapshot> {
  const [month, week, budgets, recent] = await Promise.all([
    getReport(db, userId, 'month', date),
    getReport(db, userId, 'week', date),
    getBudgetProgress(db, userId, date),
    listExpenses(db, userId, { limit: RECENT_LIMIT }),
  ])

  const summarize = (report: typeof month): PeriodSummary => ({
    total: report.total,
    previous: report.previous,
  })

  return {
    month: summarize(month),
    week: summarize(week),
    budgets,
    recentExpenses: recent.items.map(({ id, amountMinor, currency, categoryId, occurredAt, note }) => ({
      id,
      amountMinor,
      currency,
      categoryId,
      occurredAt,
      note,
    })),
  }
}
