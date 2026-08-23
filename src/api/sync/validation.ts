import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { amountMinorSchema } from '../expenses/validation';
import { hook } from '../categories/validation';

/**
 * Zod schemas for the sync resource (ticket #13). Push items carry a client
 * uuid, the client's updatedAt, and the FULL row payload; deletions arrive as
 * the same payload with deletedAt set (tombstone).
 */

const updatedAtSchema = z.iso.datetime();
const deletedAtSchema = z.iso.datetime().nullish();
const categoryIdSchema = z.uuid();

export const pushCategoryItemSchema = z.object({
    id: z.uuid(),
    updatedAt: updatedAtSchema,
    name: z.string().trim().min(1).max(100),
    deletedAt: deletedAtSchema,
});

export const pushExpenseItemSchema = z.object({
    id: z.uuid(),
    updatedAt: updatedAtSchema,
    amountMinor: amountMinorSchema,
    occurredAt: z.iso.datetime(),
    categoryId: categoryIdSchema.nullish(),
    note: z.string().max(1000).nullish(),
    deletedAt: deletedAtSchema,
});

export const pushBatchSchema = z.object({
    expenses: z.array(pushExpenseItemSchema).max(500).optional(),
    categories: z.array(pushCategoryItemSchema).max(500).optional(),
});

export const pullQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().optional(),
});

export type PushCategoryItem = z.infer<typeof pushCategoryItemSchema>;
export type PushExpenseItem = z.infer<typeof pushExpenseItemSchema>;
export type PushBatch = z.infer<typeof pushBatchSchema>;
export type PullQuery = z.infer<typeof pullQuerySchema>;

export const validateJson = <S extends z.ZodType>(schema: S) => zValidator('json', schema, hook);

export const validateQuery = <S extends z.ZodType>(schema: S) => zValidator('query', schema, hook);
