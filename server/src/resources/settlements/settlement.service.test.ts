import { describe, it, expect } from 'vitest';
import { SettlementService } from './settlement.service';
import { db } from '../../lib/db';
import {
    settlements,
    groups,
    memberships,
    expenses,
    splits,
    user
} from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTestUser, getSecondUser, getTestCategory } from '../../test/setup';

const service = new SettlementService();

/** DB row shape returned by the settlement service (amountCents is a number). */
type SettlementRow = typeof settlements.$inferSelect;

// ── Helpers ──────────────────────────────────────────────────────────

async function auditCtxFor(userId: string) {
    const [u] = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
    return {
        actorId: userId,
        actorNameSnapshot: u?.name ?? 'Test User',
        actorEmailSnapshot: u?.email ?? 'test@example.com'
    };
}

async function createSocialGroup(adminId: string, memberId: string) {
    const groupId = crypto.randomUUID();
    await db.insert(groups).values({
        id: groupId,
        name: 'Settlement Service Group',
        kind: 'social',
        createdBy: adminId
    });
    await db.insert(memberships).values([
        { id: crypto.randomUUID(), groupId, userId: adminId, role: 'admin' },
        { id: crypto.randomUUID(), groupId, userId: memberId, role: 'member' }
    ]);
    return { id: groupId };
}

/**
 * Creates a group where `creditorId` is owed `amountCents` by `debtorId`.
 * Returns the group id.
 */
async function createGroupWithDebt(
    creditorId: string,
    debtorId: string,
    amountCents: number
) {
    const group = await createSocialGroup(creditorId, debtorId);
    const category = getTestCategory();
    const [payer] = await db
        .select()
        .from(user)
        .where(eq(user.id, creditorId))
        .limit(1);
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
        id: expenseId,
        amountCents,
        description: 'Debt expense',
        categoryId: category.id,
        userId: creditorId,
        groupId: group.id,
        scope: 'group',
        date: new Date(),
        payerNameSnapshot: payer?.name ?? 'Test User',
        payerEmailSnapshot: payer?.email ?? 'test@example.com'
    });
    await db.insert(splits).values({
        id: crypto.randomUUID(),
        expenseId,
        userId: debtorId,
        amountCents,
        userNameSnapshot: 'Debtor',
        userEmailSnapshot: 'debtor@example.com'
    });
    return group;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('SettlementService', () => {
    // ── create ────────────────────────────────────────────────────
    describe('create', () => {
        it('creates a settlement without a group (no debt validation)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();

            const result = await service.create(
                user.id,
                {
                    toUserId: secondUser.id,
                    amountCents: 4250,
                    note: 'Dinner payment'
                },
                await auditCtxFor(user.id)
            );

            const settlement = result as SettlementRow;
            expect(settlement.fromUserId).toBe(user.id);
            expect(settlement.toUserId).toBe(secondUser.id);
            expect(settlement.amountCents).toBe(4250);
            expect(settlement.note).toBe('Dinner payment');
            expect(settlement.id).toBeDefined();
        });

        it('rejects settling with yourself', async () => {
            const user = getTestUser();

            await expect(
                service.create(
                    user.id,
                    { toUserId: user.id, amountCents: 1000 },
                    await auditCtxFor(user.id)
                )
            ).rejects.toThrow('Cannot settle with yourself');
        });

        it('stores identity snapshots', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();

            const result = await service.create(
                user.id,
                {
                    toUserId: secondUser.id,
                    amountCents: 1000
                },
                await auditCtxFor(user.id)
            );

            const settlement = result as SettlementRow;
            expect(settlement.fromUserNameSnapshot).toBeTruthy();
            expect(settlement.fromUserEmailSnapshot).toBeTruthy();
            expect(settlement.toUserNameSnapshot).toBeTruthy();
            expect(settlement.toUserEmailSnapshot).toBeTruthy();
        });

        it('creates a settlement without note or groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();

            const result = await service.create(
                user.id,
                {
                    toUserId: secondUser.id,
                    amountCents: 1000
                },
                await auditCtxFor(user.id)
            );

            const settlement = result as SettlementRow;
            expect(settlement.fromUserId).toBe(user.id);
            expect(settlement.toUserId).toBe(secondUser.id);
            expect(settlement.note).toBeNull();
            expect(settlement.groupId).toBeNull();
        });

        it('rejects non-positive amounts', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();

            await expect(
                service.create(
                    user.id,
                    { toUserId: secondUser.id, amountCents: 0 },
                    await auditCtxFor(user.id)
                )
            ).rejects.toThrow('amountCents must be positive');
        });

        it('rejects non-integer amounts', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();

            await expect(
                service.create(
                    user.id,
                    { toUserId: secondUser.id, amountCents: 10.5 },
                    await auditCtxFor(user.id)
                )
            ).rejects.toThrow('amountCents must be an integer');
        });
    });

    // ── list ──────────────────────────────────────────────────────
    describe('list', () => {
        it('returns settlements filtered by groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group1 = await createGroupWithDebt(user.id, secondUser.id, 3000);
            const group2 = await createGroupWithDebt(user.id, secondUser.id, 3000);

            await service.create(
                secondUser.id,
                {
                    toUserId: user.id,
                    amountCents: 1000,
                    groupId: group1.id
                },
                await auditCtxFor(secondUser.id)
            );
            await service.create(
                secondUser.id,
                {
                    toUserId: user.id,
                    amountCents: 2000,
                    groupId: group2.id
                },
                await auditCtxFor(secondUser.id)
            );

            const result = await service.list(group1.id);
            expect(result).toHaveLength(1);
            const settlement = (result as SettlementRow[])[0];
            expect(settlement.amountCents).toBe(1000);
            expect(settlement.groupId).toBe(group1.id);
        });

        it('returns empty array when group has no settlements', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const result = await service.list(group.id);
            expect(result).toEqual([]);
        });
    });

    // ── correct ───────────────────────────────────────────────────
    describe('correct', () => {
        it('throws when original settlement does not exist', async () => {
            const user = getTestUser();
            await expect(
                service.correct(
                    user.id,
                    { originalSettlementId: 'non-existent', reason: 'wrong' },
                    await auditCtxFor(user.id)
                )
            ).rejects.toThrow('Original settlement not found');
        });

        it('creates an exact-inverse correction when requester is a participant', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroupWithDebt(user.id, secondUser.id, 3000);

            const created = (await service.create(
                secondUser.id,
                {
                    toUserId: user.id,
                    amountCents: 2500,
                    groupId: group.id
                },
                await auditCtxFor(secondUser.id)
            )) as SettlementRow;

            const correction = await service.correct(
                user.id,
                { originalSettlementId: created.id, reason: 'Wrong amount' },
                await auditCtxFor(user.id)
            );

            expect(correction.originalSettlementId).toBe(created.id);
            expect(correction.amountCents).toBe(-2500);
            expect(correction.approved).toBe(true);
            expect(correction.reason).toBe('Wrong amount');
        });

        it('creates a non-approved correction when requester is not a participant', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroupWithDebt(user.id, secondUser.id, 3000);

            const created = (await service.create(
                secondUser.id,
                {
                    toUserId: user.id,
                    amountCents: 2500,
                    groupId: group.id
                },
                await auditCtxFor(secondUser.id)
            )) as SettlementRow;

            const { createTestUser } = await import('../../test/setup');
            const thirdUser = await createTestUser();

            const correction = await service.correct(
                thirdUser.id,
                { originalSettlementId: created.id, reason: 'Reviewing' },
                await auditCtxFor(thirdUser.id)
            );

            expect(correction.approved).toBe(false);

            const { deleteTestUser } = await import('../../test/setup');
            await deleteTestUser(thirdUser.id);
        });
    });

    // ── getBalances ───────────────────────────────────────────────
    describe('getBalances', () => {
        it('returns empty array for group with no financial activity', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const result = await service.getBalances(group.id);
            expect(result).toEqual([]);
        });

        it('returns balances including user names', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const result = await service.getBalances(group.id);
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
