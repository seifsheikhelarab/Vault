import * as z from 'zod';

export const createAdjustmentSchema = z.object({
    expenseId: z.string().min(1),
    amountCents: z
        .number()
        .int('amountCents must be an integer (cents)')
        .refine((v) => v !== 0, 'Adjustment amount cannot be zero')
        .refine(
            (v) => Math.abs(v) <= 100_000_000,
            'amountCents exceeds business maximum'
        ),
    reason: z.string().min(1).max(500),
    allocations: z
        .array(
            z.object({
                userId: z.string().min(1),
                amountCentsDelta: z
                    .number()
                    .int('amountCentsDelta must be an integer (cents)')
            })
        )
        .min(1)
});

export const approveAdjustmentSchema = z.object({
    id: z.string().min(1)
});

export const rejectAdjustmentSchema = z.object({
    id: z.string().min(1),
    reason: z.string().max(500).optional()
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type CreateAdjustmentAllocationInput = NonNullable<
    z.infer<typeof createAdjustmentSchema>['allocations']
>[number];
