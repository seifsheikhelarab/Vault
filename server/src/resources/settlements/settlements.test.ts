import { describe, it, expect } from 'vitest';
import {
    app,
    getTestUser,
    getSecondUser,
    getTestCategory,
    getAuthHeaders
} from '../../test/setup';
import { db } from '../../lib/db';
import { expenses, groups, memberships, user } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

// ── Helpers ──────────────────────────────────────────────────────────

/** Creates a social group with the second user as a member */
async function createSocialGroup(adminId: string, memberId: string) {
    const groupId = crypto.randomUUID();
    const [g] = await db
        .insert(groups)
        .values({
            id: groupId,
            name: 'Balance Group',
            kind: 'social',
            createdBy: adminId
        })
        .returning();
    await db.insert(memberships).values([
        { id: crypto.randomUUID(), groupId, userId: adminId, role: 'admin' },
        { id: crypto.randomUUID(), groupId, userId: memberId, role: 'member' }
    ]);
    return g;
}

/** Creates a group expense via direct DB insert */
async function createGroupExpense(
    userId: string,
    groupId: string,
    amountCents = 10000
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
        description: 'Test expense',
        categoryId: category.id,
        userId,
        groupId,
        scope: 'group',
        date: new Date(),
        payerNameSnapshot: payer?.name ?? 'Test User',
        payerEmailSnapshot: payer?.email ?? 'test@example.com'
    });
    return { id: expenseId, amountCents, userId };
}

/** Creates splits via the API */
async function createSplits(
    userId: string,
    expenseId: string,
    splitData: { userId: string; amountCents: number }[]
) {
    const res = await app.request('/api/splits', {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ expenseId, splits: splitData })
    });
    return await res.json();
}

/** Creates a settlement via the API */
async function createSettlement(
    userId: string,
    toUserId: string,
    amountCents: number,
    groupId?: string,
    note?: string
) {
    const res = await app.request('/api/settlements', {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ toUserId, amountCents, groupId, note })
    });
    const body = await res.json();
    return { res, body };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Settlements API', () => {
    // ── POST /api/settlements ─────────────────────────────────────┐
    describe('POST /api/settlements', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/settlements', {
                method: 'POST',
                body: JSON.stringify({ toUserId: 'any', amountCents: 1000 })
            });
            expect(res.status).toBe(401);
        });

        it('rejects zero and negative amounts', async () => {
            const user = getTestUser();
            const { res, body } = await createSettlement(
                user.id,
                getSecondUser().id,
                0
            );
            expect(res.status).toBe(400);
            // Zod schema validation rejects non-positive amountCents
            expect(body.error.name).toBe('ZodError');
        });

        it('rejects settling with yourself', async () => {
            const user = getTestUser();
            const { res, body } = await createSettlement(
                user.id,
                user.id,
                1000
            );
            expect(res.status).toBe(400);
            expect(body.error.message).toContain('Cannot settle with yourself');
        });

        it('returns 201 and creates a settlement against an existing debt', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            // Create a debt: user pays $50, splits 25/25 → secondUser owes user
            const expense = await createGroupExpense(user.id, group.id, 5000);
            await createSplits(user.id, expense.id, [
                { userId: user.id, amountCents: 2500 },
                { userId: secondUser.id, amountCents: 2500 }
            ]);

            const { res, body } = await createSettlement(
                secondUser.id,
                user.id,
                2550,
                group.id,
                'Venmo payment'
            );
            expect(res.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.fromUserId).toBe(secondUser.id);
            expect(body.data.toUserId).toBe(user.id);
            expect(body.data.amountCents).toBe(2550);
            expect(body.data.groupId).toBe(group.id);
            expect(body.data.note).toBe('Venmo payment');
        });

        it('rejects a settlement exceeding the outstanding debt', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            // Debt is only $25, but try to settle $100
            const expense = await createGroupExpense(user.id, group.id, 5000);
            await createSplits(user.id, expense.id, [
                { userId: user.id, amountCents: 2500 },
                { userId: secondUser.id, amountCents: 2500 }
            ]);

            const { res, body } = await createSettlement(
                secondUser.id,
                user.id,
                10000,
                group.id
            );
            expect(res.status).toBe(400);
            expect(body.error.message).toContain('exceeds outstanding debt');
        });
    });

    // ── GET /api/settlements ──────────────────────────────────────┐
    describe('GET /api/settlements', () => {
        it('returns settlements for the group', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            await createSettlement(user.id, secondUser.id, 1500, group.id);

            const res = await app.request(
                `/api/settlements?groupId=${group.id}`,
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.data.length).toBeGreaterThanOrEqual(1);
        });

        it('filters settlements by groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group1 = await createSocialGroup(user.id, secondUser.id);
            const group2 = await createSocialGroup(user.id, secondUser.id);
            await createSettlement(user.id, secondUser.id, 1000, group1.id);
            await createSettlement(user.id, secondUser.id, 2000, group2.id);

            // Filter by group1
            const res = await app.request(
                `/api/settlements?groupId=${group1.id}`,
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            const body = await res.json();
            expect(body.data.length).toBe(1);
            expect(body.data[0].amountCents).toBe(1000);
            expect(body.data[0].groupId).toBe(group1.id);
        });
    });
});

// ── Balance Calculation Integration Tests ────────────────────────────

describe('Balance calculations', () => {
    it('returns empty balances when no expenses exist', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        const res = await app.request(`/api/settlements/balances/${group.id}`, {
            headers: getAuthHeaders(user.id)
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toEqual([]);
    });

    it('computes correct balances when one person pays and splits equally', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, splits $50 each
        const groupExpense = await createGroupExpense(user.id, group.id, 10000);
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amountCents: 5000 },
            { userId: secondUser.id, amountCents: 5000 }
        ]);

        const res = await app.request(`/api/settlements/balances/${group.id}`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();
        expect(body.success).toBe(true);

        // User paid $100, owes $50 (split) → net +$50 (creditor)
        // Second user owes $50 (split) → net -$50 (debtor)
        const balances = body.data as {
            userId: string;
            balanceCents: number;
        }[];
        const userBal = balances.find((b) => b.userId === user.id);
        const secondBal = balances.find((b) => b.userId === secondUser.id);
        expect(userBal?.balanceCents).toBe(5000);
        expect(secondBal?.balanceCents).toBe(-5000);
        // Balances are zero-sum
        expect(balances.reduce((s, b) => s + b.balanceCents, 0)).toBe(0);
    });

    it('computes correct balances with uneven split', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, but secondUser owes $70 (not even)
        const groupExpense = await createGroupExpense(user.id, group.id, 10000);
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amountCents: 3000 },
            { userId: secondUser.id, amountCents: 7000 }
        ]);

        const res = await app.request(`/api/settlements/balances/${group.id}`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();
        const balances = body.data as {
            userId: string;
            balanceCents: number;
        }[];
        expect(balances.find((b) => b.userId === user.id)?.balanceCents).toBe(
            7000
        );
        expect(
            balances.find((b) => b.userId === secondUser.id)?.balanceCents
        ).toBe(-7000);
    });

    it('computes net-zero when payer takes the full split', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, takes $100 split — full self-pay, secondUser owes nothing
        const groupExpense = await createGroupExpense(user.id, group.id, 10000);
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amountCents: 10000 }
        ]);

        const res = await app.request(`/api/settlements/balances/${group.id}`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();
        const balances = body.data as {
            userId: string;
            balanceCents: number;
        }[];
        const userBal = balances.find((b) => b.userId === user.id);
        expect(userBal?.balanceCents ?? 0).toBe(0);
        expect(balances.reduce((s, b) => s + b.balanceCents, 0)).toBe(0);
    });

    it('adjusts balances after a settlement is made', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, splits 50/50 → secondUser owes $50
        const groupExpense = await createGroupExpense(user.id, group.id, 10000);
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amountCents: 5000 },
            { userId: secondUser.id, amountCents: 5000 }
        ]);

        // Second user pays back $30 via settlement
        await createSettlement(secondUser.id, user.id, 3000, group.id);

        const res = await app.request(`/api/settlements/balances/${group.id}`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();
        const balances = body.data as {
            userId: string;
            balanceCents: number;
        }[];
        // After settlement: user net +50 -30 = +20, secondUser -50 +30 = -20
        expect(balances.find((b) => b.userId === user.id)?.balanceCents).toBe(
            2000
        );
        expect(
            balances.find((b) => b.userId === secondUser.id)?.balanceCents
        ).toBe(-2000);
    });

    it('fully settles all debts after complete payment', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, splits 50/50 → secondUser owes $50
        const groupExpense = await createGroupExpense(user.id, group.id, 10000);
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amountCents: 5000 },
            { userId: secondUser.id, amountCents: 5000 }
        ]);

        // Second user pays back exactly $50
        await createSettlement(secondUser.id, user.id, 5000, group.id);

        const res = await app.request(`/api/settlements/balances/${group.id}`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();
        const balances = body.data as {
            userId: string;
            balanceCents: number;
        }[];
        const total = balances.reduce((s, b) => s + b.balanceCents, 0);
        expect(total).toBe(0);
    });

    it('handles multiple expenses with different payers', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100 dinner, splits 50/50 → secondUser owes $50 to user
        const exp1 = await createGroupExpense(user.id, group.id, 10000);
        await createSplits(user.id, exp1.id, [
            { userId: user.id, amountCents: 5000 },
            { userId: secondUser.id, amountCents: 5000 }
        ]);

        // Second user pays $60 drinks, splits 30/30 → user owes $30 to secondUser
        const exp2 = await createGroupExpense(secondUser.id, group.id, 6000);
        await createSplits(secondUser.id, exp2.id, [
            { userId: user.id, amountCents: 3000 },
            { userId: secondUser.id, amountCents: 3000 }
        ]);

        const res = await app.request(`/api/settlements/balances/${group.id}`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();
        const balances = body.data as {
            userId: string;
            balanceCents: number;
        }[];
        // Net: user +50 (exp1) -30 (exp2) = +20, secondUser +30 (exp2) -50 (exp1) = -20
        expect(balances.find((b) => b.userId === user.id)?.balanceCents).toBe(
            2000
        );
        expect(
            balances.find((b) => b.userId === secondUser.id)?.balanceCents
        ).toBe(-2000);
        expect(balances.reduce((s, b) => s + b.balanceCents, 0)).toBe(0);
    });

    it('returns 403 when requesting balances for a non-member group', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        // Create a group where secondUser is NOT a member (only primary user is)
        const group = await createSocialGroup(user.id, user.id);

        const res = await app.request(
            `/api/settlements/balances/${group.id}`,
            {
                headers: getAuthHeaders(secondUser.id)
            }
        );
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('FORBIDDEN');
    });
});
