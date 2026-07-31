import * as z from 'zod';

export const createClaimSchema = z.object({
    expenseId: z.string().min(1)
});

export const claimQuerySchema = z.object({
    groupId: z.string().optional(),
    userId: z.string().optional(),
    status: z.enum(['submitted', 'approved', 'rejected', 'reimbursed']).optional()
});

export const rejectClaimSchema = z.object({
    note: z.string().max(500).optional()
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type ClaimQueryInput = z.infer<typeof claimQuerySchema>;
export type RejectClaimInput = z.infer<typeof rejectClaimSchema>;
