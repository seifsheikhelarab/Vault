import * as z from 'zod';

export const createBudgetSchema = z.object({
    categoryId: z.string().min(1),
    amount: z.number().positive(),
    period: z.enum(['monthly', 'weekly', 'yearly']).default('monthly'),
    groupId: z.string().optional()
});

export const updateBudgetSchema = z.object({
    amount: z.number().positive().optional(),
    period: z.enum(['monthly', 'weekly', 'yearly']).optional()
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
