import { describe, it, expect } from 'vitest';
import { SettlementService } from './settlement.service';
import { db } from '../../lib/db';
import { settlements, groups, memberships } from '../../lib/db/schema';
import { getTestUser, getSecondUser } from '../../test/setup';

const service = new SettlementService();

/** DB row shape returned by the settlement service (amount is numeric→string). */
type SettlementRow = typeof settlements.$inferSelect;

// ── Helpers ──────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────

describe('SettlementService', () => {
    // ── create ────────────────────────────────────────────────────
    describe('create', () => {
        it('creates a settlement with correct fields', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const result = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 42.5,
                groupId: group.id,
                note: 'Dinner payment'
            });

            const settlement = result as SettlementRow;
            expect(settlement.fromUserId).toBe(user.id);
            expect(settlement.toUserId).toBe(secondUser.id);
            expect(settlement.amount).toBe('42.50');
            expect(settlement.groupId).toBe(group.id);
            expect(settlement.note).toBe('Dinner payment');
            expect(settlement.id).toBeDefined();
        });

        it('creates a settlement without note or groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();

            const result = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 10
            });

            const settlement = result as SettlementRow;
            expect(settlement.fromUserId).toBe(user.id);
            expect(settlement.toUserId).toBe(secondUser.id);
            expect(settlement.note).toBeNull();
            expect(settlement.groupId).toBeNull();
        });
    });

    // ── list ──────────────────────────────────────────────────────
    describe('list', () => {
        it('returns only settlements where user is the sender', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 15,
                groupId: group.id
            });

            const result = await service.list(user.id, {});
            expect(Array.isArray(result)).toBe(true);
            const list = result as SettlementRow[];
            expect(list.length).toBeGreaterThanOrEqual(1);
            list.forEach((s) => {
                expect(s.fromUserId).toBe(user.id);
            });
        });

        it('filters settlements by groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group1 = await createSocialGroup(user.id, secondUser.id);
            const group2 = await createSocialGroup(user.id, secondUser.id);

            await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 10,
                groupId: group1.id
            });
            await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 20,
                groupId: group2.id
            });

            const result = await service.list(user.id, { groupId: group1.id });
            expect(result).toHaveLength(1);
            const settlement = (result as SettlementRow[])[0];
            expect(Number(settlement.amount)).toBe(10);
            expect(settlement.groupId).toBe(group1.id);
        });

        it('returns empty array when user has no settlements', async () => {
            const secondUser = getSecondUser();
            const result = await service.list(secondUser.id, {});
            expect(result).toEqual([]);
        });
    });

    // ── getById ───────────────────────────────────────────────────
    describe('getById', () => {
        it('returns null for non-existent settlement', async () => {
            const result = await service.getById(
                getTestUser().id,
                'non-existent'
            );
            expect(result).toBeNull();
        });

        it('returns null when user is neither sender nor receiver', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const created = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 25,
                groupId: group.id
            });

            const result = await service.getById(
                'unrelated-user-id',
                (created as SettlementRow).id
            );
            expect(result).toBeNull();
        });

        it('returns settlement when user is the sender', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const created = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 25,
                groupId: group.id
            });

            const result = await service.getById(user.id, (created as SettlementRow).id);
            expect(result).not.toBeNull();
            const settlement = result as SettlementRow;
            expect(settlement.fromUserId).toBe(user.id);
            expect(settlement.toUserId).toBe(secondUser.id);
            expect(Number(settlement.amount)).toBe(25);
        });

        it('returns settlement when user is the receiver', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const created = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 30,
                groupId: group.id
            });

            const result = await service.getById(
                secondUser.id,
                (created as SettlementRow).id
            );
            expect(result).not.toBeNull();
            const settlement = result as SettlementRow;
            expect(settlement.toUserId).toBe(secondUser.id);
        });
    });

    // ── Edge cases ────────────────────────────────────────────────
    describe('edge cases', () => {
        it('handles zero-amount settlement', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const result = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 0,
                groupId: group.id
            });

            const settlement = result as SettlementRow;
            expect(settlement.amount).toBe('0.00');
            expect(settlement.fromUserId).toBe(user.id);
        });

        it('handles overpayment settlement (amount larger than typical)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const result = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 9999.99,
                groupId: group.id,
                note: 'Large overpayment'
            });

            const settlement = result as SettlementRow;
            expect(settlement.amount).toBe('9999.99');
            expect(settlement.note).toBe('Large overpayment');
        });

        it('allows duplicate settlements between same users', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const s1 = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 25,
                groupId: group.id
            });
            const s2 = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 25,
                groupId: group.id
            });

            expect((s1 as SettlementRow).id).not.toBe((s2 as SettlementRow).id);
            const list = await service.list(user.id, { groupId: group.id });
            expect(list).toHaveLength(2);
        });

        it('list excludes received settlements (only shows sender)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const sent = await service.create(user.id, {
                toUserId: secondUser.id,
                amount: 10,
                groupId: group.id
            });
            await service.create(secondUser.id, {
                toUserId: user.id,
                amount: 20,
                groupId: group.id
            });

            const userList = await service.list(user.id, {});
            (userList as SettlementRow[]).forEach((s) => {
                expect(s.fromUserId).toBe(user.id);
            });
            const ours = (userList as SettlementRow[]).find(
                (s) => s.id === (sent as SettlementRow).id
            );
            expect(ours).toBeDefined();
            expect(Number(ours!.amount)).toBe(10);
        });
    });
});
