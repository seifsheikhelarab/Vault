import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
    settlements,
    settlementCorrections,
    expenses,
    expenseTombstones,
    splits,
    adjustments,
    adjustmentAllocations,
    memberships,
    groups,
    user
} from '../../lib/db/schema';
import {
    recordAuditEvent,
    AuditAction,
    type AuditContext
} from '../../lib/audit';
import type {
    CreateSettlementInput,
    CreateSettlementCorrectionInput
} from './settlement.schema';

const BUSINESS_MAX_CENTS = 100_000_000;

export class SettlementService {
    create = createSettlement;
    list = listSettlements;
    getBalances = getBalances;
    correct = correctSettlement;
    delete = deleteSettlement;
    isGroupMember = isGroupMember;
}

// ─── Identity snapshot helper ───────────────────────────────────────────────

async function getUserSnapshot(userId: string) {
    const [u] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
    return {
        name: u?.name ?? 'Unknown',
        email: u?.email ?? 'unknown@unknown'
    };
}

// ─── Derived balance computation ────────────────────────────────────────────

/**
 * Compute derived balances for a group.
 * Balances = sum of (splits where user owes) - sum of (splits where user is owed)
 *           + sum of adjustments (approved only)
 *           - settlements (from) + settlements (to)
 *           + settlement corrections
 */
async function computeDerivedBalances(
    groupId: string
): Promise<Record<string, number>> {
    const balanceMap: Record<string, number> = {};

    // Group expenses (excluding tombstoned): credit the payer the full amount
    const groupExpenses = await db
        .select({
            id: expenses.id,
            userId: expenses.userId,
            amountCents: expenses.amountCents
        })
        .from(expenses)
        .leftJoin(
            expenseTombstones,
            eq(expenseTombstones.expenseId, expenses.id)
        )
        .where(
            and(eq(expenses.groupId, groupId), isNull(expenseTombstones.id))
        );

    for (const e of groupExpenses) {
        // Payer fronted the full amount — the group owes them
        balanceMap[e.userId] = (balanceMap[e.userId] ?? 0) + e.amountCents;
    }

    // Splits (of non-tombstoned expenses): each participant owes their share
    const groupSplits = await db
        .select({
            userId: splits.userId,
            amountCents: splits.amountCents
        })
        .from(splits)
        .innerJoin(expenses, eq(splits.expenseId, expenses.id))
        .leftJoin(
            expenseTombstones,
            eq(expenseTombstones.expenseId, expenses.id)
        )
        .where(
            and(eq(expenses.groupId, groupId), isNull(expenseTombstones.id))
        );

    for (const s of groupSplits) {
        balanceMap[s.userId] = (balanceMap[s.userId] ?? 0) - s.amountCents;
    }

    // Approved adjustment allocation deltas: positive delta = new liability
    const adjAllocations = await db
        .select({
            userId: adjustmentAllocations.userId,
            amountCentsDelta: adjustmentAllocations.amountCentsDelta
        })
        .from(adjustmentAllocations)
        .innerJoin(
            adjustments,
            eq(adjustmentAllocations.adjustmentId, adjustments.id)
        )
        .innerJoin(expenses, eq(adjustments.expenseId, expenses.id))
        .where(
            and(
                eq(expenses.groupId, groupId),
                eq(adjustments.status, 'approved')
            )
        );

    for (const a of adjAllocations) {
        balanceMap[a.userId] = (balanceMap[a.userId] ?? 0) - a.amountCentsDelta;
    }

    // Subtract settlements (from = pays, reduces their debt)
    const groupSettlements = await db
        .select()
        .from(settlements)
        .where(eq(settlements.groupId, groupId));

    // Settlement: from pays to. This reduces the payer's debt (positive
    // balance) and reduces the recipient's credit (negative balance).
    for (const s of groupSettlements) {
        balanceMap[s.fromUserId] =
            (balanceMap[s.fromUserId] ?? 0) + s.amountCents;
        balanceMap[s.toUserId] = (balanceMap[s.toUserId] ?? 0) - s.amountCents;
    }

    // Apply approved settlement corrections
    const corrections = await db
        .select({
            fromUserId: settlements.fromUserId,
            toUserId: settlements.toUserId,
            amountCents: settlementCorrections.amountCents
        })
        .from(settlementCorrections)
        .innerJoin(
            settlements,
            eq(settlementCorrections.originalSettlementId, settlements.id)
        )
        .where(
            and(
                eq(settlements.groupId, groupId),
                eq(settlementCorrections.approved, true)
            )
        );

    // Corrections store the exact inverse (negative) of the original
    // settlement, so they undo the settlement's balance effect.
    for (const c of corrections) {
        balanceMap[c.fromUserId] =
            (balanceMap[c.fromUserId] ?? 0) + c.amountCents;
        balanceMap[c.toUserId] = (balanceMap[c.toUserId] ?? 0) - c.amountCents;
    }

    return balanceMap;
}

// ─── Get balances ───────────────────────────────────────────────────────────

/**
 * Get derived balances for a group. Requires the caller to be a member.
 * Returns null when the caller is not a member (access denied).
 */
export async function getBalances(groupId: string, userId?: string) {
    if (userId) {
        const [membership] = await db
            .select()
            .from(memberships)
            .where(
                and(
                    eq(memberships.groupId, groupId),
                    eq(memberships.userId, userId)
                )
            )
            .limit(1);
        if (!membership) return null;
    }

    const balances = await computeDerivedBalances(groupId);

    // Fetch user info
    const userIds = Object.keys(balances);
    if (userIds.length === 0) return [];

    const users = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(sql`${user.id} IN ${userIds}`);

    const userMap = new Map(users.map((u) => [u.id, u]));

    return userIds.map((uid) => ({
        userId: uid,
        userName: userMap.get(uid)?.name ?? 'Unknown',
        userEmail: userMap.get(uid)?.email ?? '',
        balanceCents: balances[uid]
    }));
}

/**
 * Membership check helper for the balances endpoint.
 * Returns true when the user is an active member of the group.
 */
export async function isGroupMember(groupId: string, userId: string) {
    const [membership] = await db
        .select()
        .from(memberships)
        .where(
            and(
                eq(memberships.groupId, groupId),
                eq(memberships.userId, userId)
            )
        )
        .limit(1);
    return !!membership;
}

// ─── Create settlement ──────────────────────────────────────────────────────

export async function createSettlement(
    fromUserId: string,
    data: CreateSettlementInput,
    auditCtx: AuditContext
) {
    if (!Number.isInteger(data.amountCents))
        throw new Error('amountCents must be an integer');
    if (data.amountCents <= 0) throw new Error('amountCents must be positive');
    if (data.amountCents > BUSINESS_MAX_CENTS)
        throw new Error('amountCents exceeds business maximum');
    if (data.toUserId === fromUserId)
        throw new Error('Cannot settle with yourself');

    const fromUser = await getUserSnapshot(fromUserId);
    const toUser = await getUserSnapshot(data.toUserId);

    // Capture derived-debt context before payment
    let debtContextSnapshot: Record<string, number> | null = null;

    // Verify group exists, is not closed, and both users are members
    if (data.groupId) {
        const [grp] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, data.groupId))
            .limit(1);
        if (!grp) throw new Error('Group not found');
        if (grp.closed) throw new Error('Cannot settle in a closed group');

        const members = await db
            .select({ userId: memberships.userId })
            .from(memberships)
            .where(eq(memberships.groupId, data.groupId));
        const memberIds = new Set(members.map((m) => m.userId));
        if (!memberIds.has(fromUserId))
            throw new Error('Payer is not a member of this group');
        if (!memberIds.has(data.toUserId))
            throw new Error('Recipient is not a member of this group');

        // Derived-debt validation: recipient must be a creditor and the
        // amount must not exceed the outstanding debt (ADR 0030).
        const balances = await computeDerivedBalances(data.groupId);
        const payerBalance = balances[fromUserId] ?? 0;
        const recipientBalance = balances[data.toUserId] ?? 0;
        if (recipientBalance <= 0)
            throw new Error(
                'Recipient has no outstanding credit to settle'
            );
        const payable = Math.min(payerBalance, recipientBalance);
        if (data.amountCents > payable)
            throw new Error(
                `Amount exceeds outstanding debt of ${payable} cents`
            );

        debtContextSnapshot = balances;
    } else {
        debtContextSnapshot = null;
    }

    const id = crypto.randomUUID();

    await db.transaction(async (tx) => {
        await tx.insert(settlements).values({
            id,
            fromUserId,
            fromUserNameSnapshot: fromUser.name,
            fromUserEmailSnapshot: fromUser.email,
            toUserId: data.toUserId,
            toUserNameSnapshot: toUser.name,
            toUserEmailSnapshot: toUser.email,
            amountCents: data.amountCents,
            groupId: data.groupId ?? null,
            note: data.note ?? null,
            debtContextSnapshot: debtContextSnapshot
                ? JSON.stringify(debtContextSnapshot)
                : null
        });

        await recordAuditEvent(
            auditCtx,
            AuditAction.SETTLEMENT_CREATED,
            {
                groupId: data.groupId,
                targetType: 'settlement',
                targetId: id,
                reason: data.note
            },
            tx
        );
    });

    const [created] = await db
        .select()
        .from(settlements)
        .where(eq(settlements.id, id));
    return created;
}

// ─── List settlements ───────────────────────────────────────────────────────

export async function listSettlements(groupId?: string, userId?: string) {
    const conditions = [];
    if (groupId) conditions.push(eq(settlements.groupId, groupId));
    if (userId) {
        conditions.push(
            or(
                eq(settlements.fromUserId, userId),
                eq(settlements.toUserId, userId)
            )
        );
    }

    return db
        .select()
        .from(settlements)
        .where(and(...conditions))
        .orderBy(desc(settlements.createdAt));
}

// ─── Correct settlement (compensating, exact inverse) ───────────────────────

export async function correctSettlement(
    requesterId: string,
    data: CreateSettlementCorrectionInput,
    auditCtx: AuditContext
) {
    const [original] = await db
        .select()
        .from(settlements)
        .where(eq(settlements.id, data.originalSettlementId))
        .limit(1);
    if (!original) throw new Error('Original settlement not found');

    // The correction must be the exact inverse
    const inverseAmount = -original.amountCents;

    // Self-approval allowed for original payer or recipient
    const isParticipant =
        requesterId === original.fromUserId ||
        requesterId === original.toUserId;

    const requester = await getUserSnapshot(requesterId);
    const correctionId = crypto.randomUUID();
    const approved = isParticipant;

    await db.transaction(async (tx) => {
        await tx.insert(settlementCorrections).values({
            id: correctionId,
            originalSettlementId: data.originalSettlementId,
            amountCents: inverseAmount,
            reason: data.reason,
            requesterId,
            requesterNameSnapshot: requester.name,
            requesterEmailSnapshot: requester.email,
            approved
        });

        await recordAuditEvent(
            auditCtx,
            AuditAction.SETTLEMENT_CORRECTED,
            {
                groupId: original.groupId ?? undefined,
                targetType: 'settlement',
                targetId: data.originalSettlementId,
                reason: data.reason
            },
            tx
        );
    });

    const [correction] = await db
        .select()
        .from(settlementCorrections)
        .where(eq(settlementCorrections.id, correctionId));
    return correction;
}

// ─── Delete settlement (soft — record a correction that negates it) ────────

export async function deleteSettlement(
    settlementId: string,
    requesterId: string,
    auditCtx: AuditContext
) {
    return correctSettlement(
        requesterId,
        {
            originalSettlementId: settlementId,
            reason: 'Settlement deleted by user'
        },
        auditCtx
    );
}
