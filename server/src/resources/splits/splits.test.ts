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

/** JSON shape of a split from the splits API */
interface SplitResponse {
    userId: string;
    amount: string;
    expenseId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Creates a social group with the second user as a member */
async function createSocialGroup(adminId: string, memberId: string) {
    const groupId = crypto.randomUUID();
    const [g] = await db
        .insert(groups)
        .values({
            id: groupId,
            name: 'Split Group',
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

/** Creates a group expense via direct DB insert and returns it */
async function createGroupExpense(
    userId: string,
    groupId: string,
    amount = '90.00'
) {
    const category = getTestCategory();
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
        id: expenseId,
        amount,
        description: 'Group dinner',
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
    const body = await res.json();
    return { res, body };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Splits API', () => {
    // ── POST /api/splits ──────────────────────────────────────────
    describe('POST /api/splits', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/splits', {
                method: 'POST',
                body: JSON.stringify({ expenseId: 'any', splits: [] })
            });
            expect(res.status).toBe(401);
        });

        it('returns 404 when expense does not exist', async () => {
            const user = getTestUser();
            const { res, body } = await createSplits(user.id, 'non-existent', [
                { userId: user.id, amount: 50 }
            ]);
            expect(res.status).toBe(404);
            expect(body.error.code).toBe('NOT_FOUND');
        });

        it("returns 403 when expense doesn't belong to user", async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const groupExpense = await createGroupExpense(user.id, group.id);

            // Try to split an expense not owned by secondUser
            const { res, body } = await createSplits(
                secondUser.id,
                groupExpense.id,
                [
                    { userId: user.id, amount: 30 },
                    { userId: secondUser.id, amount: 60 }
                ]
            );
            expect(res.status).toBe(403);
            expect(body.error.code).toBe('FORBIDDEN');
        });

        it('returns 400 when splits do not equal expense amount', async () => {
            const user = getTestUser();
            const group = await createSocialGroup(user.id, getSecondUser().id);
            const groupExpense = await createGroupExpense(
                user.id,
                group.id,
                '100.00'
            );

            // Splits total 80, but expense is 100
            const { res, body } = await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 30 },
                { userId: getSecondUser().id, amount: 50 }
            ]);
            expect(res.status).toBe(400);
            expect(body.error.code).toBe('BAD_REQUEST');
            expect(body.error.message).toContain(
                'Splits must equal expense amount'
            );
        });

        it('returns 201 and creates splits with valid data', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const groupExpense = await createGroupExpense(
                user.id,
                group.id,
                '90.00'
            );

            const { res, body } = await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 30 },
                { userId: secondUser.id, amount: 60 }
            ]);
            expect(res.status).toBe(201);
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.data.length).toBe(2);
            expect(
                body.data.find((s: SplitResponse) => s.userId === user.id)?.amount
            ).toBe('30.00');
            expect(
                body.data.find((s: SplitResponse) => s.userId === secondUser.id)?.amount
            ).toBe('60.00');
        });

        it('replaces existing splits when creating new ones', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const groupExpense = await createGroupExpense(
                user.id,
                group.id,
                '100.00'
            );

            // First split: 50/50
            await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 50 },
                { userId: secondUser.id, amount: 50 }
            ]);

            // Second split: 30/70 (replaces)
            const { res, body } = await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 30 },
                { userId: secondUser.id, amount: 70 }
            ]);
            expect(res.status).toBe(201);
            expect(body.data.length).toBe(2);
            expect(
                body.data.find((s: SplitResponse) => s.userId === user.id)?.amount
            ).toBe('30.00');
            expect(
                body.data.find((s: SplitResponse) => s.userId === secondUser.id)?.amount
            ).toBe('70.00');
        });
    });

    // ── GET /api/splits ────────────────────────────────────────────
    describe('GET /api/splits', () => {
        it('returns splits filtered by expenseId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const groupExpense = await createGroupExpense(
                user.id,
                group.id,
                '80.00'
            );
            await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 40 },
                { userId: secondUser.id, amount: 40 }
            ]);

            const res = await app.request(
                `/api/splits?expenseId=${groupExpense.id}`,
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.length).toBe(2);
            body.data.forEach((s: SplitResponse) => {
                expect(s.expenseId).toBe(groupExpense.id);
            });
        });

        it('returns splits filtered by groupId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const groupExpense = await createGroupExpense(
                user.id,
                group.id,
                '60.00'
            );
            await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 30 },
                { userId: secondUser.id, amount: 30 }
            ]);

            const res = await app.request(`/api/splits?groupId=${group.id}`, {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.length).toBe(2);
        });

        it('returns 400 when no filter is provided', async () => {
            const user = getTestUser();
            const res = await app.request('/api/splits', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(400);
        });
    });

    // ── DELETE /api/splits ────────────────────────────────────────
    describe('DELETE /api/splits', () => {
        it('returns 400 when expenseId is missing', async () => {
            const user = getTestUser();
            const res = await app.request('/api/splits', {
                method: 'DELETE',
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(400);
        });

        it("returns 403 when expense doesn't belong to user", async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const groupExpense = await createGroupExpense(
                user.id,
                group.id,
                '50.00'
            );
            await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 25 },
                { userId: secondUser.id, amount: 25 }
            ]);

            const res = await app.request(
                `/api/splits?expenseId=${groupExpense.id}`,
                {
                    method: 'DELETE',
                    headers: getAuthHeaders(secondUser.id)
                }
            );
            expect(res.status).toBe(403);
        });

        it('returns 200 and deletes splits for the expense', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const group = await createSocialGroup(user.id, secondUser.id);
            const groupExpense = await createGroupExpense(
                user.id,
                group.id,
                '50.00'
            );
            await createSplits(user.id, groupExpense.id, [
                { userId: user.id, amount: 25 },
                { userId: secondUser.id, amount: 25 }
            ]);

            const res = await app.request(
                `/api/splits?expenseId=${groupExpense.id}`,
                {
                    method: 'DELETE',
                    headers: getAuthHeaders(user.id)
                }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.deleted).toBe(true);

            // Verify splits are gone
            const listRes = await app.request(
                `/api/splits?expenseId=${groupExpense.id}`,
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            const listBody = await listRes.json();
            expect(listBody.data).toEqual([]);
        });
    });
});
