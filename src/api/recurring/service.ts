import { HTTPException } from 'hono/http-exception'
import { Prisma, type PrismaClient } from '../../generated/prisma/client'
import type { Frequency } from '../../generated/prisma/enums'
import {
  assertCategoryOwned,
  deleteOwnedOr404,
  findOwnedOr404,
  serializeAmountMinor,
} from '../../utils/ownership'
import type { CreateRecurringInput, UpdateRecurringInput } from './validation'

/**
 * Recurring service (ticket #9). Definitions are scoped by userId like every
 * resource; materialization is the pure seam from spec #1: `materializeDue(db,
 * now, userId?)` creates one Expense per due occurrence, idempotently, and is
 * only given the real clock by the cron handler.
 *
 * Cadence model: occurrences are UTC calendar dates starting at anchorDate.
 * nextRunAt always holds the next un-materialized occurrence (UTC midnight),
 * so a single run naturally backfills everything missed since the last run —
 * downtime catch-up needs no separate scan. lastMaterializedAt records when
 * the definition was last processed. Idempotency comes from the schema's
 * unique(recurringDefinitionId, occurrenceDate): a rerun hits P2002 per
 * occurrence and skips, so crashes and double-runs never duplicate rows (and
 * user-deleted tombstones keep their slot — NULLS DISTINCT keeps the row).
 */

const DAY_MS = 86_400_000

/** Runaway guard: at most this many occurrences per definition per run. */
export const MAX_OCCURRENCES_PER_RUN = 1000

function parseAnchorDate(anchorDate: string): Date {
  const date = new Date(`${anchorDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new HTTPException(422, { message: 'Invalid anchorDate' })
  return date
}

/** Normalize any timestamp to its UTC calendar-day midnight. */
function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Next occurrence after `cursor`, staying on the anchorDate cadence in UTC day
 * grain. Monthly keeps the anchor's day-of-month clamped to each target month
 * (Jan 31 → Feb 28 → Mar 31), so no drift accumulates across short months.
 */
export function nextOccurrence(
  anchorDayOfMonth: number,
  cursor: Date,
  frequency: Frequency,
  interval: number,
): Date {
  if (frequency === 'daily') return new Date(cursor.getTime() + interval * DAY_MS)
  if (frequency === 'weekly') return new Date(cursor.getTime() + interval * 7 * DAY_MS)
  const totalMonth = cursor.getUTCMonth() + interval
  const year = cursor.getUTCFullYear() + Math.floor(totalMonth / 12)
  const month = totalMonth % 12
  const day = Math.min(anchorDayOfMonth, daysInMonth(year, month))
  return new Date(Date.UTC(year, month, day))
}

export async function createDefinition(db: PrismaClient, userId: string, input: CreateRecurringInput) {
  if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId)
  const anchorDate = parseAnchorDate(input.anchorDate)
  // First materializable occurrence is the anchor itself; catch-up from there.
  const row = await db.recurringDefinition.create({
    data: {
      userId,
      name: input.name,
      amountMinor: BigInt(input.amountMinor),
      categoryId: input.categoryId ?? null,
      frequency: input.frequency,
      interval: input.interval ?? 1,
      anchorDate,
      nextRunAt: anchorDate,
    },
  })
  return serializeAmountMinor(row)
}

export async function listDefinitions(db: PrismaClient, userId: string) {
  const rows = await db.recurringDefinition.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  })
  return rows.map(serializeAmountMinor)
}

export async function getDefinition(db: PrismaClient, userId: string, id: string) {
  return serializeAmountMinor(await findOwnedOr404(db.recurringDefinition, userId, id))
}

export async function updateDefinition(
  db: PrismaClient,
  userId: string,
  id: string,
  input: UpdateRecurringInput,
) {
  await findOwnedOr404(db.recurringDefinition, userId, id)
  if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId)
  // Moving the anchor restarts the cadence: nextRunAt realigns to it. Already
  // created occurrences stay put; overlapping ones dedupe on the next run.
  const anchorDate =
    input.anchorDate !== undefined ? parseAnchorDate(input.anchorDate) : undefined
  const row = await db.recurringDefinition.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.amountMinor !== undefined && { amountMinor: BigInt(input.amountMinor) }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.frequency !== undefined && { frequency: input.frequency }),
      ...(input.interval !== undefined && { interval: input.interval }),
      ...(anchorDate !== undefined && { anchorDate, nextRunAt: anchorDate }),
      ...(input.paused !== undefined && { paused: input.paused }),
    },
  })
  return serializeAmountMinor(row)
}

export async function deleteDefinition(db: PrismaClient, userId: string, id: string): Promise<void> {
  await deleteOwnedOr404(db.recurringDefinition, userId, id)
}

/**
 * Materialize every due occurrence for all active definitions (or just one
 * user's when `userId` is passed). Returns the number of expenses created;
 * skipped duplicates are not counted.
 */
export async function materializeDue(db: PrismaClient, now: Date, userId?: string) {
  const definitions = await db.recurringDefinition.findMany({
    where: { paused: false, nextRunAt: { lte: now }, ...(userId && { userId }) },
  })

  let created = 0
  for (const definition of definitions) {
    const anchorDay = utcMidnight(definition.anchorDate).getUTCDate()
    let cursor = utcMidnight(definition.nextRunAt)
    let processed = 0

    while (cursor <= now && processed < MAX_OCCURRENCES_PER_RUN) {
      try {
        await db.expense.create({
          data: {
            id: crypto.randomUUID(),
            userId: definition.userId,
            amountMinor: definition.amountMinor,
            currency: definition.currency,
            categoryId: definition.categoryId,
            occurredAt: cursor,
            recurringDefinitionId: definition.id,
            occurrenceDate: cursor,
          },
        })
        created++
      } catch (error) {
        // Already materialized on an earlier run (or a user-deleted instance
        // still holds the slot). The unique constraint makes reruns no-ops.
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        ) {
          throw error
        }
      }
      cursor = nextOccurrence(anchorDay, cursor, definition.frequency, definition.interval)
      processed++
    }

    if (processed > 0) {
      await db.recurringDefinition.update({
        where: { id: definition.id },
        data: { nextRunAt: cursor, lastMaterializedAt: now },
      })
    }
  }
  return { created }
}
