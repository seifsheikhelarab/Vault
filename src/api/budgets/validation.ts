import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { hook, idParamSchema, validateJson, validateParam } from '../categories/validation'
import { amountMinorSchema } from '../expenses/validation'

/**
 * Zod schemas for the budgets resource (ticket #8). Reuses the shared
 * validator plumbing from categories/validation and the expense amountMinor
 * bounds; the hook turns validation failures into the central 422 envelope.
 * Multiple concurrently active budgets are allowed — no uniqueness rule.
 */

const periodTypeSchema = z.enum(['week', 'month'])
const categoryIdSchema = z.uuid()

export const createBudgetSchema = z.object({
  periodType: periodTypeSchema,
  amountMinor: amountMinorSchema,
  categoryId: categoryIdSchema.optional(),
})

/** Partial update; `categoryId: null` converts a scoped budget to overall. */
export const updateBudgetSchema = z.object({
  periodType: periodTypeSchema.optional(),
  amountMinor: amountMinorSchema.optional(),
  categoryId: categoryIdSchema.nullable().optional(),
})

/**
 * The instant progress is computed for: date-only (`2026-02-18`) or full
 * ISO datetime. Optional — omitted means "now".
 */
export const progressQuerySchema = z.object({
  date: z.union([z.iso.datetime(), z.iso.date()]).optional(),
})

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>

export const validateQuery = <S extends z.ZodType>(schema: S) =>
  zValidator('query', schema, hook)

export { idParamSchema, validateJson, validateParam }
