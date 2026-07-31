import * as z from 'zod';

export const createGroupSchema = z.object({
    name: z.string().min(1).max(100),
    kind: z.enum(['social', 'department']).default('social')
});

export const updateGroupSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    kind: z.enum(['social', 'department']).optional()
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
