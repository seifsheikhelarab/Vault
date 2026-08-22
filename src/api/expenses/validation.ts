import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { hook, idParamSchema, validateJson, validateParam } from '../categories/validation'

/**
 * Zod schemas for the expenses resource (ticket #7). Reuses the shared
 * validator plumbing from categories/validation; the hook turns validation
 * failures into the central 422 envelope from config/errors.
 */

/** Minor units arrive as a JSON number, bounded to the lossless-integer range. */
export const amountMinorSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER)

const occurredAtSchema = z.iso.datetime()
const noteSchema = z.string().max(1000)
const categoryIdSchema = z.uuid()

export const createExpenseSchema = z.object({
  id: z.uuid(),
  amountMinor: amountMinorSchema,
  occurredAt: occurredAtSchema.optional(),
  categoryId: categoryIdSchema.optional(),
  note: noteSchema.optional(),
})

/** Partial update; `categoryId: null` / `note: null` clear the field. */
export const updateExpenseSchema = z.object({
  amountMinor: amountMinorSchema.optional(),
  occurredAt: occurredAtSchema.optional(),
  categoryId: categoryIdSchema.nullable().optional(),
  note: noteSchema.nullable().optional(),
})

export const listExpensesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>

export const validateQuery = <S extends z.ZodType>(schema: S) =>
  zValidator('query', schema, hook)

export { idParamSchema, validateJson, validateParam }
