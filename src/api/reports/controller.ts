import type { Context } from 'hono'
import type { AppEnv } from '../../config/env'
import { createPrisma } from '../../config/prisma'
import { getReport } from './service'
import type { ReportQueryInput } from './validation'

/**
 * Reports controllers (ticket #10). Thin like budgets: session userId plus
 * validated query in, service call, JSON report out. No narrative text —
 * JSON only per ticket.
 */
export async function weeklyReportController(c: Context<AppEnv>, query: ReportQueryInput) {
  const db = createPrisma(c.env.DATABASE_URL)
  return c.json(await getReport(db, c.get('userId'), 'week', query.date))
}

export async function monthlyReportController(c: Context<AppEnv>, query: ReportQueryInput) {
  const db = createPrisma(c.env.DATABASE_URL)
  return c.json(await getReport(db, c.get('userId'), 'month', query.date))
}
