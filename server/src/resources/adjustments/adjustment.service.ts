import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
    adjustments,
    adjustmentAllocations,
    expenses,
    user
} from '../../lib/db/schema';
import {
    recordAuditEvent,
    AuditAction,
    type AuditContext
} from '../../lib/audit';
import type { CreateAdjustmentInput } from './adjustment.schema';

const BUSINESS_MAX_CENTS = 100_000_000;

export class AdjustmentService {
    request = requestAdjustment;
    approve = approveAdjustment;
    reject = rejectAdjustment;
    list = listAdjustments;
}

async function getUserSnapshot(userId: string) {
    const [u] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
    return { name: u?.name ?? 'Unknown', email: u?.email ?? 'unknown@unknown' };
}

export async function requestAdjustment(
    requesterId: string,
    data: CreateAdjustmentInput,
    auditCtx: AuditContext
) {
    if (!Number.isInteger(data.amountCents))
        throw new Error('amountCents must be an integer');
    if (Math.abs(data.amountCents) > BUSINESS_MAX_CENTS)
        throw new Error('amountCents exceeds business maximum');

    // Verify the expense exists and requester is the payer
    const [expense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, data.expenseId))
        .limit(1);
    if (!expense) throw new Error('Expense not found');
    if (expense.userId !== requesterId)
        throw new Error('Only the payer can request an adjustment');

    // Validate allocations sum to the adjustment total
    const allocSum = data.allocations.reduce(
        (s, a) => s + a.amountCentsDelta,
        0
    );
    if (allocSum !== data.amountCents)
        throw new Error(
            `Allocation sum ${allocSum} does not match adjustment ${data.amountCents}`
        );

    const requester = await getUserSnapshot(requesterId);
    const id = crypto.randomUUID();

    await db.transaction(async (tx) => {
        await tx.insert(adjustments).values({
            id,
            expenseId: data.expenseId,
            amountCents: data.amountCents,
            reason: data.reason,
            status: 'pending',
            requesterId,
            requesterNameSnapshot: requester.name,
            requesterEmailSnapshot: requester.email
        });

        for (const alloc of data.allocations) {
            const snap = await getUserSnapshot(alloc.userId);
            await tx.insert(adjustmentAllocations).values({
                id: crypto.randomUUID(),
                adjustmentId: id,
                userId: alloc.userId,
                amountCentsDelta: alloc.amountCentsDelta,
                userNameSnapshot: snap.name,
                userEmailSnapshot: snap.email
            });
        }

        await recordAuditEvent(
            auditCtx,
            AuditAction.ADJUSTMENT_REQUESTED,
            {
                groupId: expense.groupId ?? undefined,
                targetType: 'adjustment',
                targetId: id,
                reason: data.reason
            },
            tx
        );
    });

    const [created] = await db
        .select()
        .from(adjustments)
        .where(eq(adjustments.id, id));
    return created;
}

export async function approveAdjustment(
    adjustmentId: string,
    reviewerId: string,
    auditCtx: AuditContext
) {
    const [adj] = await db
        .select()
        .from(adjustments)
        .where(eq(adjustments.id, adjustmentId))
        .limit(1);
    if (!adj) throw new Error('Adjustment not found');
    if (adj.status !== 'pending') throw new Error('Adjustment is not pending');
    if (adj.requesterId === reviewerId)
        throw new Error('Cannot self-approve an adjustment');

    const reviewer = await getUserSnapshot(reviewerId);

    await db.transaction(async (tx) => {
        await tx
            .update(adjustments)
            .set({
                status: 'approved',
                reviewerId,
                reviewerNameSnapshot: reviewer.name,
                reviewerEmailSnapshot: reviewer.email,
                reviewedAt: new Date()
            })
            .where(eq(adjustments.id, adjustmentId));

        await recordAuditEvent(
            auditCtx,
            AuditAction.ADJUSTMENT_APPROVED,
            {
                targetType: 'adjustment',
                targetId: adjustmentId
            },
            tx
        );
    });

    const [updated] = await db
        .select()
        .from(adjustments)
        .where(eq(adjustments.id, adjustmentId));
    return updated;
}

export async function rejectAdjustment(
    adjustmentId: string,
    reviewerId: string,
    reason: string | undefined,
    auditCtx: AuditContext
) {
    const [adj] = await db
        .select()
        .from(adjustments)
        .where(eq(adjustments.id, adjustmentId))
        .limit(1);
    if (!adj) throw new Error('Adjustment not found');
    if (adj.status !== 'pending') throw new Error('Adjustment is not pending');
    if (adj.requesterId === reviewerId)
        throw new Error('Cannot self-reject an adjustment');

    const reviewer = await getUserSnapshot(reviewerId);

    await db.transaction(async (tx) => {
        await tx
            .update(adjustments)
            .set({
                status: 'rejected',
                reviewerId,
                reviewerNameSnapshot: reviewer.name,
                reviewerEmailSnapshot: reviewer.email,
                reviewedAt: new Date()
            })
            .where(eq(adjustments.id, adjustmentId));

        await recordAuditEvent(
            auditCtx,
            AuditAction.ADJUSTMENT_REJECTED,
            {
                targetType: 'adjustment',
                targetId: adjustmentId,
                reason
            },
            tx
        );
    });

    const [updated] = await db
        .select()
        .from(adjustments)
        .where(eq(adjustments.id, adjustmentId));
    return updated;
}

export async function listAdjustments(expenseId: string) {
    return db
        .select()
        .from(adjustments)
        .where(eq(adjustments.expenseId, expenseId));
}
