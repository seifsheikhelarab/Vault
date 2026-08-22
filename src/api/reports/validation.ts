import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { hook } from '../categories/validation'

/**
 * Query schema for report endpoints (ticket #10). The optional `date` pins
 * the clock — date-only (`2026-02-18`) or full ISO datetime; omitted means
 * "now". Period math itself lives in utils/period.ts.
 */
export const reportQuerySchema = z.object({
  date: z.union([z.iso.datetime(), z.iso.date()]).optional(),
})

export type ReportQueryInput = z.infer<typeof reportQuerySchema>

export const validateQuery = <S extends z.ZodType>(schema: S) =>
  zValidator('query', schema, hook)
