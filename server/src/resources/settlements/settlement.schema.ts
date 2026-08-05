import * as z from 'zod';

export const createSettlementSchema = z.object({
    toUserId: z.string().min(1),
    amountCents: z
        .number()
        .int('amountCents must be an integer (cents)')
        .positive('amountCents must be positive')
        .max(100_000_000, 'amountCents exceeds business maximum'),
    groupId: z.string().optional(),
    note: z.string().max(500).optional()
});

export const createSettlementCorrectionSchema = z.object({
    originalSettlementId: z.string().min(1),
    reason: z.string().min(1).max(500)
});

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type CreateSettlementCorrectionInput = z.infer<
    typeof createSettlementCorrectionSchema
>;
