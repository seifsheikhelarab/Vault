import { describe, it, expect } from 'vitest';
import { SplitService } from './split.service';
import { db } from '../../lib/db';
import {
    expenses,
    splits,
    groups,
    memberships,
    user
} from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTestUser, getSecondUser, getTestCategory } from '../../test/setup';

const service = new SplitService();

/** DB row shape returned by the split service (amountCents is a number). */
type SplitRow = typeof splits.$inferSelect;

// ── Helpers ──────────────────────────────────────────────────────────

async function createSocialGroup(adminId: string, memberId: string) {
    const groupId = crypto.randomUUID();
    await db.insert(groups).values({
        id: groupId,
        name: 'Split Service Group',
        kind: 'social',
        createdBy: adminId
    });
    await db.insert(memberships).values([
        { id: crypto.randomUUID(), groupId, userId: adminId, role: 'admin' },
        { id: crypto.randomUUID(), groupId, userId: memberId, role: 'member' }
    ]);
    return { id: groupId };
}

async function createGroupExpense(
    userId: string,
    groupId: string,
    amountCents = 8000
) {
    const category = getTestCategory();
    const [payer] = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
        id: expenseId,
        amountCents,
        description: 'Split test expense',
        categoryId: category.id,
        userId,
        groupId,
        scope: 'group',
        date: new Date(),
        payerNameSnapshot: payer?.name ?? 'Test User',
        payerEmailSnapshot: payer?.email ?? 'test@example.com'
    });
    return { id: expenseId, amountCents };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('SplitService', () => {
    // ── create ────────────────────────────────────────────────────
    describe('create', () => {
        it('returns NOT_FOUND when expense does not exist', async () => {
            const user = getTestUser();
            const result = await service.create(user.id, {
                expenseId: 'non-existent',
                splits: [{ userId: user.id, amountCents: 5000 }]
            });
            expect(result).toEqual({ error: 'NOT_FOUND' });
        });

        it("returns FORBIDDEN when expense doesn't belong to user", async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id);

            const result = await service.create(secondUser.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 4000 },
                    { userId: secondUser.id, amountCents: 4000 }
                ]
            });
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns BAD_REQUEST when splits do not equal expense amount', async () => {
            const user = getTestUser();
            const group = await createSocialGroup(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, group.id, 10000);

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 3000 },
                    { userId: getSecondUser().id, amountCents: 4000 }
                ]
            });
            expect(result).toEqual({
                error: 'BAD_REQUEST',
                message: 'Splits must equal expense amount'
            });
        });

        it('creates splits successfully with valid data', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, 9000);

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 3000 },
                    { userId: secondUser.id, amountCents: 6000 }
                ]
            });

            expect(Array.isArray(result)).toBe(true);
            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            expect(created.find((s) => s.userId === user.id)?.amountCents).toBe(
                3000
            );
            expect(
                created.find((s) => s.userId === secondUser.id)?.amountCents
            ).toBe(6000);
        });

        it('stores identity snapshots on created splits', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, 8000);

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 4000 },
                    { userId: secondUser.id, amountCents: 4000 }
                ]
            });

            const created = result as SplitRow[];
            created.forEach((s) => {
                expect(s.userNameSnapshot).toBeTruthy();
                expect(s.userEmailSnapshot).toBeTruthy();
            });
        });

        it('replaces existing splits on re-creation', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, 10000);

            await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 5000 },
                    { userId: secondUser.id, amountCents: 5000 }
                ]
            });

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 3000 },
                    { userId: secondUser.id, amountCents: 7000 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            expect(created.find((s) => s.userId === user.id)?.amountCents).toBe(
                3000
            );
            expect(
                created.find((s) => s.userId === secondUser.id)?.amountCents
            ).toBe(7000);

            const allSplits = await db
                .select()
                .from(splits)
                .where(eq(splits.expenseId, exp.id));
            expect(allSplits).toHaveLength(2);
        });
    });

    // ── list ──────────────────────────────────────────────────────
    describe('list', () => {
        it('returns splits by expenseId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id);
            await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 4000 },
                    { userId: secondUser.id, amountCents: 4000 }
                ]
            });

            const result = await service.list({ expenseId: exp.id });
            expect(result).toHaveLength(2);
            (result as SplitRow[]).forEach((s) => {
                expect(s.expenseId).toBe(exp.id);
            });
        });

        it('returns splits by groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, 6000);
            await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 3000 },
                    { userId: secondUser.id, amountCents: 3000 }
                ]
            });

            const result = await service.list({ groupId: group.id });
            expect(result).toHaveLength(2);
        });

        it('returns empty array for group with no splits', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            await createGroupExpense(user.id, group.id);

            const result = await service.list({ groupId: group.id });
            expect(result).toEqual([]);
        });
    });

    // ── deleteByExpense ───────────────────────────────────────────
    describe('deleteByExpense', () => {
        it('returns NOT_FOUND for non-existent expense', async () => {
            const result = await service.deleteByExpense(
                getTestUser().id,
                'non-existent'
            );
            expect(result).toEqual({ error: 'NOT_FOUND' });
        });

        it("returns FORBIDDEN when expense doesn't belong to user", async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id);
            await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 4000 },
                    { userId: secondUser.id, amountCents: 4000 }
                ]
            });

            const result = await service.deleteByExpense(secondUser.id, exp.id);
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('deletes all splits for an expense', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id);
            await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 2500 },
                    { userId: secondUser.id, amountCents: 2500 }
                ]
            });

            const result = await service.deleteByExpense(user.id, exp.id);
            expect(result).toEqual({ deleted: true });

            const remaining = await db
                .select()
                .from(splits)
                .where(eq(splits.expenseId, exp.id));
            expect(remaining).toHaveLength(0);
        });
    });

    // ── Validation edge cases ─────────────────────────────────────
    describe('validation edges', () => {
        it('handles three-way splits correctly', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const { createTestUser } = await import('../../test/setup');
            const thirdUser = await createTestUser();
            const exp = await createGroupExpense(user.id, group.id, 9000);

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 3000 },
                    { userId: secondUser.id, amountCents: 3000 },
                    { userId: thirdUser.id, amountCents: 3000 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(3);
            created.forEach((s) => expect(s.amountCents).toBe(3000));

            const { deleteTestUser } = await import('../../test/setup');
            await deleteTestUser(thirdUser.id);
        });

        it('handles cent-precision splits correctly', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, 1099);

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 550 },
                    { userId: secondUser.id, amountCents: 549 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            const amounts = created.map((s) => s.amountCents);
            expect(amounts).toContain(550);
            expect(amounts).toContain(549);
        });

        it('stores zero-amount split entry when sum equals expense', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, 5000);

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amountCents: 5000 },
                    { userId: secondUser.id, amountCents: 0 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            expect(
                created.find((s) => s.userId === secondUser.id)?.amountCents
            ).toBe(0);
        });
    });
});
