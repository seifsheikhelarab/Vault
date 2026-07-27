import * as z from 'zod';

export const createExpenseSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1).max(200),
    date: z
        .string()
        .datetime()
        .transform((d) => new Date(d)),
    categoryId: z.string(),
    receiptUrl: z.string().url().optional(),
    groupId: z.string().optional(),
    scope: z.enum(['personal', 'group', 'company']).default('personal')
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    categoryId: z.string().optional(),
    scope: z.enum(['personal', 'group', 'company']).optional(),
    groupId: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseQueryInput = z.infer<typeof expenseQuerySchema>;
