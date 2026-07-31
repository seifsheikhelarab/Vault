import * as z from 'zod';

export const createSettlementSchema = z.object({
    toUserId: z.string().min(1),
    amount: z.number().positive(),
    groupId: z.string().optional(),
    note: z.string().max(200).optional()
});

export const settlementQuerySchema = z.object({
    groupId: z.string().optional()
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type SettlementQueryInput = z.infer<typeof settlementQuerySchema>;
