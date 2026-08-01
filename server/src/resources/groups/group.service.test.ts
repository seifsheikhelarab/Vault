import { describe, it, expect } from 'vitest';
import { GroupService } from './group.service';
import { db } from '../../lib/db';
import {
    groups,
    memberships,
    expenses,
    splits,
    settlements
} from '../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTestUser, getSecondUser, getTestCategory } from '../../test/setup';

const service = new GroupService();

// ── Helpers ──────────────────────────────────────────────────────────

async function createGroup(
    adminId: string,
    memberId?: string | null,
    kind: 'social' | 'department' = 'social'
) {
    const group = await service.create(adminId, {
        name: 'Service Test Group',
        kind
    });
    if (memberId && memberId !== adminId) {
        await db.insert(memberships).values({
            id: crypto.randomUUID(),
            groupId: group.id,
            userId: memberId,
            role: 'member'
        });
    }
    return group;
}

async function createExpense(payerId: string, groupId: string, amount: number) {
    const category = getTestCategory();
    const id = crypto.randomUUID();
    await db.insert(expenses).values({
        id,
        amount: String(amount),
        description: 'Test expense',
        categoryId: category.id,
        userId: payerId,
        groupId,
        scope: 'group',
        date: new Date()
    });
    return { id, amount, payerId };
}

async function createSplitsForExpense(
    expenseId: string,
    splitData: { userId: string; amount: number }[]
) {
    const rows = splitData.map((s) => ({
        id: crypto.randomUUID(),
        expenseId,
        userId: s.userId,
        amount: String(s.amount)
    }));
    await db.insert(splits).values(rows);
}

async function createSettlement(
    fromUserId: string,
    toUserId: string,
    amount: number,
    groupId: string
) {
    await db.insert(settlements).values({
        id: crypto.randomUUID(),
        fromUserId,
        toUserId,
        amount: String(amount),
        groupId
    });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GroupService', () => {
    // ── Balance calculations ──────────────────────────────────────
    describe('getBalances', () => {
        it('returns null when user is not a member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id);
            const result = await service.getBalances(secondUser.id, group.id);
            expect(result).toBeNull();
        });

        it('computes correct net and debts for an equal split', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);
            const exp = await createExpense(user.id, group.id, 100);
            await createSplitsForExpense(exp.id, [
                { userId: user.id, amount: 50 },
                { userId: secondUser.id, amount: 50 }
            ]);

            const result = await service.getBalances(user.id, group.id);
            expect(result).not.toBeNull();
            const balances = result!;

            expect(balances.net[user.id]).toBeCloseTo(50, 2);
            expect(balances.net[secondUser.id]).toBeCloseTo(-50, 2);
            expect(balances.debts).toHaveLength(1);
            expect(balances.debts[0].from).toBe(secondUser.id);
            expect(balances.debts[0].to).toBe(user.id);
            expect(balances.debts[0].amount).toBeCloseTo(50, 2);
        });

        it('computes correct debts with settlement reducing the balance', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);
            const exp = await createExpense(user.id, group.id, 100);
            await createSplitsForExpense(exp.id, [
                { userId: user.id, amount: 50 },
                { userId: secondUser.id, amount: 50 }
            ]);
            await createSettlement(secondUser.id, user.id, 30, group.id);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            expect(balances.net[user.id]).toBeCloseTo(20, 2);
            expect(balances.net[secondUser.id]).toBeCloseTo(-20, 2);
            expect(balances.debts[0].amount).toBeCloseTo(20, 2);
        });

        it('returns no debts after full settlement', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);
            const exp = await createExpense(user.id, group.id, 100);
            await createSplitsForExpense(exp.id, [
                { userId: user.id, amount: 50 },
                { userId: secondUser.id, amount: 50 }
            ]);
            await createSettlement(secondUser.id, user.id, 50, group.id);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            expect(Math.abs(balances.net[user.id] ?? 0)).toBeLessThanOrEqual(
                0.01
            );
            expect(
                Math.abs(balances.net[secondUser.id] ?? 0)
            ).toBeLessThanOrEqual(0.01);
            expect(balances.debts).toEqual([]);
        });

        it('nets multiple expenses with different payers correctly', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);

            const exp1 = await createExpense(user.id, group.id, 100);
            await createSplitsForExpense(exp1.id, [
                { userId: user.id, amount: 50 },
                { userId: secondUser.id, amount: 50 }
            ]);
            const exp2 = await createExpense(secondUser.id, group.id, 60);
            await createSplitsForExpense(exp2.id, [
                { userId: user.id, amount: 30 },
                { userId: secondUser.id, amount: 30 }
            ]);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            expect(balances.net[user.id]).toBeCloseTo(20, 2);
            expect(balances.net[secondUser.id]).toBeCloseTo(-20, 2);
            expect(balances.debts).toHaveLength(1);
            expect(balances.debts[0].from).toBe(secondUser.id);
            expect(balances.debts[0].to).toBe(user.id);
            expect(balances.debts[0].amount).toBeCloseTo(20, 2);
        });

        it('handles expenses without splits (no one owes anything)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);
            await createExpense(user.id, group.id, 100);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            // Payer gets full credit, no splits to offset
            expect(balances.net[user.id]).toBeCloseTo(100, 2);
            expect(balances.net[secondUser.id]).toBeUndefined();
            // No splits means no one owes; payer is just owed from the group (no specific debtor)
            expect(balances.debts).toEqual([]);
        });

        it('handles three members with cross-debts', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            // Create a third user dynamically
            const { createTestUser } = await import('../../test/setup');
            const thirdUser = await createTestUser();
            const group = await createGroup(user.id, secondUser.id);
            // Add third user to the group manually
            await db.insert(memberships).values({
                id: crypto.randomUUID(),
                groupId: group.id,
                userId: thirdUser.id,
                role: 'member'
            });

            // User pays $90, splits equally 30/30/30
            const exp = await createExpense(user.id, group.id, 90);
            await createSplitsForExpense(exp.id, [
                { userId: user.id, amount: 30 },
                { userId: secondUser.id, amount: 30 },
                { userId: thirdUser.id, amount: 30 }
            ]);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            // User: +90 -30 = +60, secondUser: 0 -30 = -30, thirdUser: 0 -30 = -30
            expect(balances.net[user.id]).toBeCloseTo(60, 2);
            expect(balances.net[secondUser.id]).toBeCloseTo(-30, 2);
            expect(balances.net[thirdUser.id]).toBeCloseTo(-30, 2);
            // Two debtors each owing the single creditor
            expect(balances.debts).toHaveLength(2);
            const debtAmounts = balances.debts.map((d) => d.amount);
            expect(debtAmounts.reduce((a, b) => a + b, 0)).toBeCloseTo(60, 2);
            // Clean up dynamic user
            const { deleteTestUser } = await import('../../test/setup');
            await deleteTestUser(thirdUser.id);
        });

        it('handles overpayment via settlement (creditor becomes debtor)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);
            const exp = await createExpense(user.id, group.id, 100);
            await createSplitsForExpense(exp.id, [
                { userId: user.id, amount: 50 },
                { userId: secondUser.id, amount: 50 }
            ]);
            // Second user overpays: sends $80 instead of $50
            await createSettlement(secondUser.id, user.id, 80, group.id);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            // User: +50 -80 = -30 (now owes secondUser)
            // SecondUser: -50 +80 = +30 (now is owed)
            expect(balances.net[user.id]).toBeCloseTo(-30, 2);
            expect(balances.net[secondUser.id]).toBeCloseTo(30, 2);
            expect(balances.debts).toHaveLength(1);
            expect(balances.debts[0].from).toBe(user.id);
            expect(balances.debts[0].to).toBe(secondUser.id);
            expect(balances.debts[0].amount).toBeCloseTo(30, 2);
        });

        it('handles fractional cent rounding ($100 split three ways)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const { createTestUser } = await import('../../test/setup');
            const thirdUser = await createTestUser();
            const group = await createGroup(user.id, secondUser.id);
            await db.insert(memberships).values({
                id: crypto.randomUUID(),
                groupId: group.id,
                userId: thirdUser.id,
                role: 'member'
            });

            // $100 split three ways: 33.33 + 33.33 + 33.34 = 100.00
            const exp = await createExpense(user.id, group.id, 100);
            await createSplitsForExpense(exp.id, [
                { userId: user.id, amount: 33.33 },
                { userId: secondUser.id, amount: 33.33 },
                { userId: thirdUser.id, amount: 33.34 }
            ]);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            // User: +100 -33.33 = +66.67
            expect(balances.net[user.id]).toBeCloseTo(66.67, 2);
            expect(balances.net[secondUser.id]).toBeCloseTo(-33.33, 2);
            expect(balances.net[thirdUser.id]).toBeCloseTo(-33.34, 2);
            // Total debt should match user's net credit
            const totalDebt = balances.debts.reduce((s, d) => s + d.amount, 0);
            expect(totalDebt).toBeCloseTo(66.67, 2);

            const { deleteTestUser } = await import('../../test/setup');
            await deleteTestUser(thirdUser.id);
        });

        it('nets multiple expenses with varying split ratios', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);

            // Expense 1: user pays $200, user owes $150, secondUser owes $50
            const exp1 = await createExpense(user.id, group.id, 200);
            await createSplitsForExpense(exp1.id, [
                { userId: user.id, amount: 150 },
                { userId: secondUser.id, amount: 50 }
            ]);
            // Expense 2: secondUser pays $80, each owes $40
            const exp2 = await createExpense(secondUser.id, group.id, 80);
            await createSplitsForExpense(exp2.id, [
                { userId: user.id, amount: 40 },
                { userId: secondUser.id, amount: 40 }
            ]);

            const result = await service.getBalances(user.id, group.id);
            const balances = result!;

            // User: +200 -150 -40 = +10, secondUser: +80 -50 -40 = -10
            expect(balances.net[user.id]).toBeCloseTo(10, 2);
            expect(balances.net[secondUser.id]).toBeCloseTo(-10, 2);
            expect(balances.debts).toHaveLength(1);
            expect(balances.debts[0].from).toBe(secondUser.id);
            expect(balances.debts[0].to).toBe(user.id);
            expect(balances.debts[0].amount).toBeCloseTo(10, 2);
        });
    });

    // ── Company summary ───────────────────────────────────────────
    describe('getCompanySummary', () => {
        it('returns empty when user has no department groups', async () => {
            const user = getTestUser();
            const summary = await service.getCompanySummary(user.id);
            expect(summary.departments).toEqual([]);
            expect(summary.totalBudget).toBe(0);
            expect(summary.totalSpent).toBe(0);
            expect(summary.pendingClaims).toBe(0);
        });

        it('computes department stats correctly', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(
                user.id,
                secondUser.id,
                'department'
            );

            // Create expense for the department
            await createExpense(user.id, group.id, 100);
            await createExpense(secondUser.id, group.id, 50);

            const summary = await service.getCompanySummary(user.id);

            expect(summary.departments).toHaveLength(1);
            expect(summary.departments[0].name).toBe('Service Test Group');
            expect(summary.departments[0].memberCount).toBe(2);
            expect(summary.departments[0].totalSpent).toBe(150);
            expect(summary.departments[0].expenseCount).toBe(2);
            expect(summary.totalSpent).toBe(150);
        });
    });

    // ── CRUD ──────────────────────────────────────────────────────
    describe('create', () => {
        it('creates a group and adds creator as admin', async () => {
            const user = getTestUser();
            const group = await service.create(user.id, {
                name: 'CRUD Test',
                kind: 'social'
            });

            expect(group.name).toBe('CRUD Test');
            expect(group.kind).toBe('social');
            expect(group.createdBy).toBe(user.id);

            // Verify membership exists
            const [membership] = await db
                .select()
                .from(memberships)
                .where(eq(memberships.groupId, group.id));
            expect(membership.userId).toBe(user.id);
            expect(membership.role).toBe('admin');
        });
    });

    describe('getById', () => {
        it('returns FORBIDDEN when not a member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id);
            const result = await service.getById(secondUser.id, group.id);
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns FORBIDDEN when group does not exist (no membership)', async () => {
            const user = getTestUser();
            const result = await service.getById(user.id, 'non-existent');
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns group when user is a member', async () => {
            const user = getTestUser();
            const group = await createGroup(user.id);
            const result = await service.getById(user.id, group.id);
            expect(result).not.toBeNull();
            expect((result as { name: string }).name).toBe('Service Test Group');
        });
    });

    describe('update', () => {
        it('returns FORBIDDEN for non-member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id);
            const result = await service.update(secondUser.id, group.id, {
                name: 'Hacked'
            });
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns NOT_ADMIN for regular member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);
            const result = await service.update(secondUser.id, group.id, {
                name: 'Hacked'
            });
            expect(result).toEqual({ error: 'NOT_ADMIN' });
        });

        it('updates group when admin', async () => {
            const user = getTestUser();
            const group = await createGroup(user.id);
            const result = await service.update(user.id, group.id, {
                name: 'Updated Group'
            });
            expect((result as { name: string }).name).toBe('Updated Group');
        });
    });

    describe('delete', () => {
        it('returns FORBIDDEN for non-member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id);
            const result = await service.delete(secondUser.id, group.id);
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns NOT_ADMIN for regular member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createGroup(user.id, secondUser.id);
            const result = await service.delete(secondUser.id, group.id);
            expect(result).toEqual({ error: 'NOT_ADMIN' });
        });

        it('deletes group when admin', async () => {
            const user = getTestUser();
            const group = await createGroup(user.id);
            const result = await service.delete(user.id, group.id);
            expect(result).toEqual({ deleted: true });

            // Verify group is gone
            const [g] = await db
                .select()
                .from(groups)
                .where(eq(groups.id, group.id));
            expect(g).toBeUndefined();
        });
    });
});
