import { db } from './db';
import { auditEvents } from './db/schema';

/** The transaction handle type produced by `db.transaction(tx => ...)`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Accepts the global `db` or any transaction handle `tx`. */
export type DbHandle = typeof db | Tx;

export interface AuditContext {
    actorId: string;
    actorNameSnapshot: string;
    actorEmailSnapshot: string;
}

/**
 * Record an immutable audit event. Must run on the SAME database handle
 * as the financial mutation it describes: when called inside a
 * `db.transaction(tx => ...)` the caller must pass `tx` as `dbHandle`,
 * otherwise a `max: 1` connection pool (test mode) deadlocks.
 */
export async function recordAuditEvent(
    ctx: AuditContext,
    action: string,
    params: {
        groupId?: string;
        targetType: string;
        targetId: string;
        beforeRef?: unknown;
        afterRef?: unknown;
        reason?: string;
    },
    dbHandle: DbHandle = db
): Promise<void> {
    await dbHandle.insert(auditEvents).values({
        id: crypto.randomUUID(),
        actorId: ctx.actorId,
        actorNameSnapshot: ctx.actorNameSnapshot,
        actorEmailSnapshot: ctx.actorEmailSnapshot,
        action,
        groupId: params.groupId ?? null,
        targetType: params.targetType,
        targetId: params.targetId,
        beforeRef: params.beforeRef ? JSON.stringify(params.beforeRef) : null,
        afterRef: params.afterRef ? JSON.stringify(params.afterRef) : null,
        reason: params.reason ?? null
    });
}

// ─── Action type constants ──────────────────────────────────────────────────

export const AuditAction = {
    EXPENSE_CREATED: 'expense_created',
    EXPENSE_REVISED: 'expense_revised',
    EXPENSE_DELETED: 'expense_deleted',
    SETTLEMENT_CREATED: 'settlement_created',
    SETTLEMENT_CORRECTED: 'settlement_corrected',
    ADJUSTMENT_REQUESTED: 'adjustment_requested',
    ADJUSTMENT_APPROVED: 'adjustment_approved',
    ADJUSTMENT_REJECTED: 'adjustment_rejected',
    GROUP_CREATED: 'group_created',
    GROUP_CLOSED: 'group_closed',
    MEMBERSHIP_ADDED: 'membership_added',
    MEMBERSHIP_REMOVED: 'membership_removed',
    OWNERSHIP_TRANSFERRED: 'ownership_transferred',
    BUDGET_CREATED: 'budget_created',
    BUDGET_UPDATED: 'budget_updated',
    BUDGET_DELETED: 'budget_deleted',
    CLAIM_SUBMITTED: 'claim_submitted',
    CLAIM_APPROVED: 'claim_approved',
    CLAIM_REJECTED: 'claim_rejected',
    CLAIM_REIMBURSED: 'claim_reimbursed'
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
