import * as z from 'zod';

export const createSplitSchema = z.object({
    expenseId: z.string().min(1),
    splits: z
        .array(
            z.object({
                userId: z.string().min(1),
                amount: z.number().positive()
            })
        )
        .min(1)
});

export const splitQuerySchema = z
    .object({
        expenseId: z.string().optional(),
        groupId: z.string().optional(),
        userId: z.string().optional()
    })
    .refine(
        (d) => d.expenseId || d.groupId || d.userId,
        'At least one filter required'
    );

export type CreateSplitInput = z.infer<typeof createSplitSchema>;
export type SplitQueryInput = z.infer<typeof splitQuerySchema>;
