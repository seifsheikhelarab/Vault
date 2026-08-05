import * as z from 'zod';

export const createExpenseSchema = z.object({
    amountCents: z
        .number()
        .int('amountCents must be an integer (cents)')
        .positive('amountCents must be positive')
        .max(100_000_000, 'amountCents exceeds business maximum'),
    description: z.string().min(1).max(500),
    categoryId: z.string().min(1),
    date: z.string().datetime(),
    scope: z
        .enum(['personal', 'group', 'company'])
        .optional()
        .default('personal'),
    groupId: z.string().optional(),
    receiptUrl: z.string().url().optional(),
    splits: z
        .array(
            z.object({
                userId: z.string().min(1),
                amountCents: z
                    .number()
                    .int('amountCents must be an integer (cents)')
                    .min(0, 'Split amount cannot be negative')
            })
        )
        .optional()
});

export const reviseExpenseSchema = z.object({
    amountCents: z
        .number()
        .int('amountCents must be an integer (cents)')
        .positive('amountCents must be positive')
        .max(100_000_000, 'amountCents exceeds business maximum'),
    description: z.string().min(1).max(500),
    categoryId: z.string().min(1),
    reason: z.string().min(1).max(500)
});

export const deleteExpenseSchema = z.object({
    reason: z.string().min(1).max(500)
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type ReviseExpenseInput = z.infer<typeof reviseExpenseSchema>;
export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>;
export type CreateSplitInput = NonNullable<
    z.infer<typeof createExpenseSchema>['splits']
>[number];
