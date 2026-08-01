import { describe, it, expect } from 'vitest';
import {
    app,
    getTestUser,
    getSecondUser,
    getTestCategory,
    getAuthHeaders
} from '../../test/setup';
import { db } from '../../lib/db';
import { expenses, groups, memberships } from '../../lib/db/schema';

/** JSON shape of a settlement from GET /api/settlements */
interface SettlementResponse {
    fromUserId: string;
}

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
    amount = '100.00'
) {
    const category = getTestCategory();
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
        id: expenseId,
        amount,
        description: 'Test expense',
        categoryId: category.id,
        userId,
        groupId,
        scope: 'group',
        date: new Date()
    });
    return { id: expenseId, amount, userId };
}

/** Creates splits via the API */
async function createSplits(
    userId: string,
    expenseId: string,
    splitData: { userId: string; amount: number }[]
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
    amount: number,
    groupId?: string,
    note?: string
) {
    const res = await app.request('/api/settlements', {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ toUserId, amount, groupId, note })
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
                body: JSON.stringify({ toUserId: 'any', amount: 10 })
            });
            expect(res.status).toBe(401);
        });

        it('returns 400 when settling with yourself', async () => {
            const user = getTestUser();
            const { res, body } = await createSettlement(user.id, user.id, 10);
            expect(res.status).toBe(400);
            expect(body.error.code).toBe('BAD_REQUEST');
            expect(body.error.message).toContain('Cannot settle with yourself');
        });

        it('returns 201 and creates a settlement', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);

            const { res, body } = await createSettlement(
                user.id,
                secondUser.id,
                25.5,
                group.id,
                'Venmo payment'
            );
            expect(res.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.fromUserId).toBe(user.id);
            expect(body.data.toUserId).toBe(secondUser.id);
            expect(body.data.amount).toBe('25.50');
            expect(body.data.groupId).toBe(group.id);
            expect(body.data.note).toBe('Venmo payment');
        });
    });

    // ── GET /api/settlements ──────────────────────────────────────┐
    describe('GET /api/settlements', () => {
        it('returns settlements created by the user', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            await createSettlement(user.id, secondUser.id, 15, group.id);

            const res = await app.request('/api/settlements', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.data.length).toBeGreaterThanOrEqual(1);
            // All returned settlements should be from this user
            body.data.forEach((s: SettlementResponse) => {
                expect(s.fromUserId).toBe(user.id);
            });
        });

        it('filters settlements by groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group1 = await createSocialGroup(user.id, secondUser.id);
            const group2 = await createSocialGroup(user.id, secondUser.id);
            await createSettlement(user.id, secondUser.id, 10, group1.id);
            await createSettlement(user.id, secondUser.id, 20, group2.id);

            // Filter by group1
            const res = await app.request(
                `/api/settlements?groupId=${group1.id}`,
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            const body = await res.json();
            expect(body.data.length).toBe(1);
            expect(Number(body.data[0].amount)).toBe(10);
            expect(body.data[0].groupId).toBe(group1.id);
        });
    });

    // ── GET /api/settlements/:id ──────────────────────────────────┐
    describe('GET /api/settlements/:id', () => {
        it('returns 404 for non-existent settlement', async () => {
            const user = getTestUser();
            const res = await app.request('/api/settlements/non-existent', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(404);
        });

        it('returns 200 and settlement data', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const { body: created } = await createSettlement(
                user.id,
                secondUser.id,
                42,
                group.id
            );

            const res = await app.request(
                `/api/settlements/${created.data.id}`,
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.id).toBe(created.data.id);
            expect(body.data.fromUserId).toBe(user.id);
            expect(body.data.toUserId).toBe(secondUser.id);
        });
    });
});

// ── Balance Calculation Integration Tests ────────────────────────────

describe('Balance calculations', () => {
    it('returns empty debts when no expenses exist', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(user.id)
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.debts).toEqual([]);
        expect(body.data.net).toBeDefined();
    });

    it('computes correct balances when one person pays and splits equally', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, splits $50 each
        const groupExpense = await createGroupExpense(
            user.id,
            group.id,
            '100.00'
        );
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amount: 50 },
            { userId: secondUser.id, amount: 50 }
        ]);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();
        expect(body.success).toBe(true);

        // User paid $100, owes $50 (split) → net +$50 (creditor)
        // Second user owes $50 (split) → net -$50 (debtor)
        expect(body.data.net[user.id]).toBeCloseTo(50, 2);
        expect(body.data.net[secondUser.id]).toBeCloseTo(-50, 2);

        // Debts: secondUser owes user $50
        expect(body.data.debts.length).toBe(1);
        expect(body.data.debts[0].from).toBe(secondUser.id);
        expect(body.data.debts[0].to).toBe(user.id);
        expect(body.data.debts[0].amount).toBeCloseTo(50, 2);
    });

    it('computes correct balances with uneven split', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, but secondUser owes $70 (not even)
        const groupExpense = await createGroupExpense(
            user.id,
            group.id,
            '100.00'
        );
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amount: 30 },
            { userId: secondUser.id, amount: 70 }
        ]);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();

        expect(body.data.net[user.id]).toBeCloseTo(70, 2);
        expect(body.data.net[secondUser.id]).toBeCloseTo(-70, 2);

        expect(body.data.debts.length).toBe(1);
        expect(body.data.debts[0].from).toBe(secondUser.id);
        expect(body.data.debts[0].to).toBe(user.id);
        expect(body.data.debts[0].amount).toBeCloseTo(70, 2);
    });

    it('computes net-zero when payer takes the full split', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, takes $100 split — full self-pay, secondUser owes nothing
        // User net: +100 -100 = 0. secondUser: 0
        const groupExpense = await createGroupExpense(
            user.id,
            group.id,
            '100.00'
        );
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amount: 100 }
        ]);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();

        // Both nets should be near 0 (within 0.01 threshold for debt generation)
        expect(Math.abs(body.data.net[user.id] ?? 0)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(body.data.net[secondUser.id] ?? 0)).toBeLessThanOrEqual(
            0.01
        );
        expect(body.data.debts).toEqual([]);
    });

    it('adjusts balances after a settlement is made', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, splits 50/50 → secondUser owes $50
        const groupExpense = await createGroupExpense(
            user.id,
            group.id,
            '100.00'
        );
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amount: 50 },
            { userId: secondUser.id, amount: 50 }
        ]);

        // Second user pays back $30 via settlement
        await createSettlement(secondUser.id, user.id, 30, group.id);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();

        // After settlement: user net +50 -30 = +20, secondUser -50 +30 = -20
        expect(body.data.net[user.id]).toBeCloseTo(20, 2);
        expect(body.data.net[secondUser.id]).toBeCloseTo(-20, 2);

        // Debt reduced to $20
        expect(body.data.debts.length).toBe(1);
        expect(body.data.debts[0].amount).toBeCloseTo(20, 2);
    });

    it('fully settles all debts after complete payment', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100, splits 50/50 → secondUser owes $50
        const groupExpense = await createGroupExpense(
            user.id,
            group.id,
            '100.00'
        );
        await createSplits(user.id, groupExpense.id, [
            { userId: user.id, amount: 50 },
            { userId: secondUser.id, amount: 50 }
        ]);

        // Second user pays back exactly $50
        await createSettlement(secondUser.id, user.id, 50, group.id);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();

        // Everything settled — all nets near 0, no debts
        expect(Math.abs(body.data.net[user.id] ?? 0)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(body.data.net[secondUser.id] ?? 0)).toBeLessThanOrEqual(
            0.01
        );
        expect(body.data.debts).toEqual([]);
    });

    it('handles multiple expenses with different payers', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        const group = await createSocialGroup(user.id, secondUser.id);

        // User pays $100 dinner, splits 50/50 → secondUser owes $50 to user
        const exp1 = await createGroupExpense(user.id, group.id, '100.00');
        await createSplits(user.id, exp1.id, [
            { userId: user.id, amount: 50 },
            { userId: secondUser.id, amount: 50 }
        ]);

        // Second user pays $60 drinks, splits 30/30 → user owes $30 to secondUser
        const exp2 = await createGroupExpense(secondUser.id, group.id, '60.00');
        await createSplits(secondUser.id, exp2.id, [
            { userId: user.id, amount: 30 },
            { userId: secondUser.id, amount: 30 }
        ]);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(user.id)
        });
        const body = await res.json();

        // Net: user +50 (exp1) -30 (exp2) = +20
        //      secondUser +30 (exp2) -50 (exp1) = -20
        expect(body.data.net[user.id]).toBeCloseTo(20, 2);
        expect(body.data.net[secondUser.id]).toBeCloseTo(-20, 2);

        // Debt: secondUser owes user $20
        expect(body.data.debts.length).toBe(1);
        expect(body.data.debts[0].from).toBe(secondUser.id);
        expect(body.data.debts[0].to).toBe(user.id);
        expect(body.data.debts[0].amount).toBeCloseTo(20, 2);
    });

    it('returns 403 when requesting balances for a non-member group', async () => {
        const user = getTestUser();
        const secondUser = getSecondUser();
        // Create a group where secondUser is NOT a member (only primary user is)
        const group = await createSocialGroup(user.id, user.id);

        const res = await app.request(`/api/groups/${group.id}/balances`, {
            headers: getAuthHeaders(secondUser.id)
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('FORBIDDEN');
    });
});
