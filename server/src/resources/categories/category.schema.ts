import * as z from 'zod';

export const createCategorySchema = z.object({
    name: z.string().min(1).max(100),
    icon: z.string().max(10).optional()
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
