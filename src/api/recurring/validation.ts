import { z } from 'zod'
import { amountMinorSchema, idParamSchema, validateJson, validateParam } from '../expenses/validation'
import { hook } from '../categories/validation'

/**
 * Zod schemas for the recurring resource (ticket #9). Reuses the shared
 * validator plumbing and amount schema from expenses/validation; anchorDate is
 * a plain calendar date (YYYY-MM-DD) matching the @db.Date column.
 */

export const frequencySchema = z.enum(['daily', 'weekly', 'monthly'])

const nameSchema = z.string().trim().min(1).max(100)
const anchorDateSchema = z.iso.date()
const intervalSchema = z.number().int().min(1).max(1000)

export const createRecurringSchema = z.object({
  name: nameSchema,
  amountMinor: amountMinorSchema,
  categoryId: z.uuid().optional(),
  frequency: frequencySchema,
  interval: intervalSchema.optional(),
  anchorDate: anchorDateSchema,
})

/** Partial update; `categoryId: null` clears it. Pause/resume = `paused` flag. */
export const updateRecurringSchema = z.object({
  name: nameSchema.optional(),
  amountMinor: amountMinorSchema.optional(),
  categoryId: z.uuid().nullable().optional(),
  frequency: frequencySchema.optional(),
  interval: intervalSchema.optional(),
  anchorDate: anchorDateSchema.optional(),
  paused: z.boolean().optional(),
})

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>

export { idParamSchema, validateJson, validateParam }
