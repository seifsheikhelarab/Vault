import * as z from 'zod';

export const createBudgetSchema = z.object({
    categoryId: z.string().min(1),
    amountCents: z
        .number()
        .int('amountCents must be an integer (cents)')
        .positive('amountCents must be positive')
        .max(100_000_000, 'amountCents exceeds business maximum'),
    period: z
        .enum(['monthly', 'weekly', 'yearly'])
        .optional()
        .default('monthly'),
    groupId: z.string().optional()
});

export const updateBudgetSchema = z.object({
    amountCents: z
        .number()
        .int('amountCents must be an integer (cents)')
        .positive('amountCents must be positive')
        .max(100_000_000, 'amountCents exceeds business maximum')
        .optional(),
    period: z.enum(['monthly', 'weekly', 'yearly']).optional()
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
