import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { zodError } from '../../config/errors'

/**
 * Zod schemas + validators for the categories resource (ticket #6). The hook
 * turns validation failures into the central 422 envelope from config/errors.
 */

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
})

/** Rename-only PATCH: same shape as create. */
export const updateCategorySchema = createCategorySchema

export const idParamSchema = z.object({
  id: z.uuid(),
})

type Hook = Parameters<typeof zValidator>[2]

/** Shared 422-envelope hook; reused by other resources' validators. */
export const hook: Hook = (result, c: Context) =>
  result.success ? undefined : zodError(result.error as z.ZodError, c)

export const validateJson = <S extends z.ZodType>(schema: S) =>
  zValidator('json', schema, hook)

export const validateParam = <S extends z.ZodType>(schema: S) =>
  zValidator('param', schema, hook)
