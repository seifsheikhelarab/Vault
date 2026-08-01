import { describe, it, expect } from 'vitest';
import { SplitService } from './split.service';
import { db } from '../../lib/db';
import { expenses, splits, groups, memberships } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTestUser, getSecondUser, getTestCategory } from '../../test/setup';

const service = new SplitService();

/** DB row shape returned by the split service (amount is numeric→string). */
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
    amount = '80.00'
) {
    const category = getTestCategory();
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
        id: expenseId,
        amount,
        description: 'Split test expense',
        categoryId: category.id,
        userId,
        groupId,
        scope: 'group',
        date: new Date()
    });
    return { id: expenseId, amount };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('SplitService', () => {
    // ── create ────────────────────────────────────────────────────
    describe('create', () => {
        it('returns NOT_FOUND when expense does not exist', async () => {
            const user = getTestUser();
            const result = await service.create(user.id, {
                expenseId: 'non-existent',
                splits: [{ userId: user.id, amount: 50 }]
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
                    { userId: user.id, amount: 40 },
                    { userId: secondUser.id, amount: 40 }
                ]
            });
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns BAD_REQUEST when splits do not equal expense amount', async () => {
            const user = getTestUser();
            const group = await createSocialGroup(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, group.id, '100.00');

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 30 },
                    { userId: getSecondUser().id, amount: 40 }
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
            const exp = await createGroupExpense(user.id, group.id, '90.00');

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 30 },
                    { userId: secondUser.id, amount: 60 }
                ]
            });

            expect(Array.isArray(result)).toBe(true);
            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            expect(created.find((s) => s.userId === user.id)?.amount).toBe(
                '30.00'
            );
            expect(
                created.find((s) => s.userId === secondUser.id)?.amount
            ).toBe('60.00');
        });

        it('replaces existing splits on re-creation', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, '100.00');

            await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 50 },
                    { userId: secondUser.id, amount: 50 }
                ]
            });

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 30 },
                    { userId: secondUser.id, amount: 70 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            expect(created.find((s) => s.userId === user.id)?.amount).toBe(
                '30.00'
            );
            expect(
                created.find((s) => s.userId === secondUser.id)?.amount
            ).toBe('70.00');

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
                    { userId: user.id, amount: 40 },
                    { userId: secondUser.id, amount: 40 }
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
            const exp = await createGroupExpense(user.id, group.id, '60.00');
            await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 30 },
                    { userId: secondUser.id, amount: 30 }
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
                    { userId: user.id, amount: 40 },
                    { userId: secondUser.id, amount: 40 }
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
                    { userId: user.id, amount: 25 },
                    { userId: secondUser.id, amount: 25 }
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
            const exp = await createGroupExpense(user.id, group.id, '90.00');

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 30 },
                    { userId: secondUser.id, amount: 30 },
                    { userId: thirdUser.id, amount: 30 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(3);
            created.forEach((s) => expect(s.amount).toBe('30.00'));

            const { deleteTestUser } = await import('../../test/setup');
            await deleteTestUser(thirdUser.id);
        });

        it('handles cent-precision splits correctly', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, '10.99');

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 5.5 },
                    { userId: secondUser.id, amount: 5.49 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            const amounts = created.map((s) => s.amount);
            expect(amounts).toContain('5.50');
            expect(amounts).toContain('5.49');
        });

        it('stores zero-amount split entry when sum equals expense', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, group.id, '50.00');

            const result = await service.create(user.id, {
                expenseId: exp.id,
                splits: [
                    { userId: user.id, amount: 50 },
                    { userId: secondUser.id, amount: 0 }
                ]
            });

            const created = result as SplitRow[];
            expect(created).toHaveLength(2);
            expect(
                Number(
                    created.find((s) => s.userId === secondUser.id)?.amount
                )
            ).toBe(0);
        });
    });
});
