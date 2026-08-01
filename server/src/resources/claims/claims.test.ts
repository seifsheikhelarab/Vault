import { describe, it, expect } from 'vitest';
import {
    app,
    getTestUser,
    getSecondUser,
    getTestCategory,
    getAuthHeaders
} from '../../test/setup';
import { db } from '../../lib/db';
import { expenses, memberships, groups } from '../../lib/db/schema';


/** JSON shape of a claim + expense from GET /api/claims */
interface ClaimResponse {
    id: string;
    status: string;
    expense: { userId: string };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Creates a department group and adds the second user as member */
async function createDepartmentWithMember(adminId: string, memberId: string) {
    const groupId = crypto.randomUUID();
    const [g] = await db
        .insert(groups)
        .values({
            id: groupId,
            name: 'Dept Test',
            kind: 'department',
            createdBy: adminId
        })
        .returning();
    await db.insert(memberships).values([
        { id: crypto.randomUUID(), groupId, userId: adminId, role: 'admin' },
        { id: crypto.randomUUID(), groupId, userId: memberId, role: 'member' }
    ]);
    return g;
}

/** Creates an expense in a department group and returns its data */
async function createGroupExpense(userId: string, groupId: string) {
    const category = getTestCategory();
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
        id: expenseId,
        amount: '100.00',
        description: 'Test expense for claim',
        categoryId: category.id,
        userId,
        groupId,
        scope: 'company',
        date: new Date()
    });
    return {
        id: expenseId,
        amount: '100.00',
        description: 'Test expense for claim',
        userId
    };
}

/** Creates a claim via the API */
async function createClaim(userId: string, expenseId: string) {
    const res = await app.request('/api/claims', {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ expenseId })
    });
    const body = await res.json();
    return { res, body };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Claims API', () => {
    // ── POST /api/claims ───────────────────────────────────────────
    describe('POST /api/claims', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/claims', {
                method: 'POST',
                body: JSON.stringify({ expenseId: 'any' })
            });
            expect(res.status).toBe(401);
        });

        it('returns 404 when expense does not exist', async () => {
            const user = getTestUser();
            const res = await app.request('/api/claims', {
                method: 'POST',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ expenseId: 'non-existent' })
            });
            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error.code).toBe('NOT_FOUND');
        });

        it("returns 403 when expense doesn't belong to user", async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const dept = await createDepartmentWithMember(
                user.id,
                secondUser.id
            );

            // Create expense as first user but try to claim as second user
            const groupExpense = await createGroupExpense(user.id, dept.id);

            const { res, body } = await createClaim(
                secondUser.id,
                groupExpense.id
            );
            expect(res.status).toBe(403);
            expect(body.error.code).toBe('FORBIDDEN');
        });

        it('returns 409 when expense already has a claim', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);

            // First claim — should succeed
            const { res: firstRes } = await createClaim(
                user.id,
                groupExpense.id
            );
            expect(firstRes.status).toBe(201);

            // Second claim on same expense — should be 409
            const res = await app.request('/api/claims', {
                method: 'POST',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ expenseId: groupExpense.id })
            });
            expect(res.status).toBe(409);
            const body = await res.json();
            expect(body.error.code).toBe('CONFLICT');
        });

        it('returns 201 and creates claim with valid data', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);

            const { res, body } = await createClaim(user.id, groupExpense.id);
            expect(res.status).toBe(201);
            expect(body.success).toBe(true);
            expect(body.data).toBeDefined();
            expect(body.data.expenseId).toBe(groupExpense.id);
            expect(body.data.status).toBe('submitted');
            expect(body.data.id).toBeDefined();
        });
    });

    // ── GET /api/claims ────────────────────────────────────────────
    describe('GET /api/claims', () => {
        it('returns claims for department groups the user belongs to', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);
            await createClaim(user.id, groupExpense.id);

            const res = await app.request('/api/claims', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
            expect(body.data.length).toBeGreaterThanOrEqual(1);
            expect(body.data[0].expense).toBeDefined();
            expect(body.data[0].expense.id).toBe(groupExpense.id);
        });

        it('filters claims by status', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);
            await createClaim(user.id, groupExpense.id);

            // Should find the submitted claim
            const res = await app.request('/api/claims?status=submitted', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.every((c: ClaimResponse) => c.status === 'submitted')).toBe(
                true
            );

            // Should not find any approved claims
            const res2 = await app.request('/api/claims?status=approved', {
                headers: getAuthHeaders(user.id)
            });
            const body2 = await res2.json();
            expect(body2.data).toEqual([]);
        });

        it('filters claims by userId', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const dept = await createDepartmentWithMember(
                user.id,
                secondUser.id
            );

            // Both users submit claims
            const exp1 = await createGroupExpense(user.id, dept.id);
            const exp2 = await createGroupExpense(secondUser.id, dept.id);
            await createClaim(user.id, exp1.id);
            await createClaim(secondUser.id, exp2.id);

            // Filter by first user — assertions account for claims from earlier tests
            const res = await app.request(`/api/claims?userId=${user.id}`, {
                headers: getAuthHeaders(user.id)
            });
            const body = await res.json();
            expect(body.data.length).toBeGreaterThanOrEqual(1);
            expect(
                body.data.every((c: ClaimResponse) => c.expense.userId === user.id)
            ).toBe(true);
        });
    });

    // ── PATCH /api/claims/:id/approve ──────────────────────────────
    describe('PATCH /api/claims/:id/approve', () => {
        it('returns 404 for non-existent claim', async () => {
            const user = getTestUser();
            const res = await app.request('/api/claims/non-existent/approve', {
                method: 'PATCH',
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(404);
        });

        it('returns 200 and approves the claim', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);
            const { body: claim } = await createClaim(user.id, groupExpense.id);

            const res = await app.request(
                `/api/claims/${claim.data.id}/approve`,
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(user.id)
                }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.status).toBe('approved');
            expect(body.data.reviewerId).toBe(user.id);
            expect(body.data.reviewedAt).toBeDefined();
        });
    });

    // ── PATCH /api/claims/:id/reject ───────────────────────────────
    describe('PATCH /api/claims/:id/reject', () => {
        it('returns 404 for non-existent claim', async () => {
            const user = getTestUser();
            const res = await app.request('/api/claims/non-existent/reject', {
                method: 'PATCH',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ note: 'bad' })
            });
            expect(res.status).toBe(404);
        });

        it('returns 200 and rejects with a note', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);
            const { body: claim } = await createClaim(user.id, groupExpense.id);

            const res = await app.request(
                `/api/claims/${claim.data.id}/reject`,
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(user.id),
                    body: JSON.stringify({ note: 'Missing receipt' })
                }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.status).toBe('rejected');
            expect(body.data.reviewNote).toBe('Missing receipt');
            expect(body.data.reviewedAt).toBeDefined();
        });
    });

    // ── PATCH /api/claims/:id/reimburse ────────────────────────────
    describe('PATCH /api/claims/:id/reimburse', () => {
        it('returns 404 for non-existent claim', async () => {
            const user = getTestUser();
            const res = await app.request(
                '/api/claims/non-existent/reimburse',
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(user.id)
                }
            );
            expect(res.status).toBe(404);
        });

        it('returns 200 and marks as reimbursed', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);
            const { body: claim } = await createClaim(user.id, groupExpense.id);

            // First approve, then reimburse
            await app.request(`/api/claims/${claim.data.id}/approve`, {
                method: 'PATCH',
                headers: getAuthHeaders(user.id)
            });

            const res = await app.request(
                `/api/claims/${claim.data.id}/reimburse`,
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(user.id)
                }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.status).toBe('reimbursed');
        });
    });

    // ── Full workflow tests ────────────────────────────────────────
    describe('Claim lifecycle', () => {
        it('completes the full submit → approve → reimburse workflow', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);

            // 1. Submit claim
            const { body: submitBody } = await createClaim(
                user.id,
                groupExpense.id
            );
            const claimId = submitBody.data.id;
            expect(submitBody.data.status).toBe('submitted');

            // 2. Approve
            const approveRes = await app.request(
                `/api/claims/${claimId}/approve`,
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(user.id)
                }
            );
            const approveBody = await approveRes.json();
            expect(approveBody.data.status).toBe('approved');

            // 3. Reimburse
            const reimburseRes = await app.request(
                `/api/claims/${claimId}/reimburse`,
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(user.id)
                }
            );
            const reimburseBody = await reimburseRes.json();
            expect(reimburseBody.data.status).toBe('reimbursed');

            // 4. Verify final state via list
            const listRes = await app.request('/api/claims?status=reimbursed', {
                headers: getAuthHeaders(user.id)
            });
            const listBody = await listRes.json();
            expect(listBody.data.some((c: ClaimResponse) => c.id === claimId)).toBe(true);
        });

        it('completes the full submit → reject workflow', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(
                user.id,
                getSecondUser().id
            );
            const groupExpense = await createGroupExpense(user.id, dept.id);

            // 1. Submit
            const { body: submitBody } = await createClaim(
                user.id,
                groupExpense.id
            );
            const claimId = submitBody.data.id;

            // 2. Reject with note
            const rejectRes = await app.request(
                `/api/claims/${claimId}/reject`,
                {
                    method: 'PATCH',
                    headers: getAuthHeaders(user.id),
                    body: JSON.stringify({ note: 'Invalid category' })
                }
            );
            const rejectBody = await rejectRes.json();
            expect(rejectBody.data.status).toBe('rejected');
            expect(rejectBody.data.reviewNote).toBe('Invalid category');

            // 3. Verify it's not in the approved/reimbursed lists
            const approvedRes = await app.request(
                '/api/claims?status=approved',
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            const approvedBody = await approvedRes.json();
            expect(approvedBody.data.some((c: ClaimResponse) => c.id === claimId)).toBe(
                false
            );

            // 4. But it IS in the rejected list
            const rejectedRes = await app.request(
                '/api/claims?status=rejected',
                {
                    headers: getAuthHeaders(user.id)
                }
            );
            const rejectedBody = await rejectedRes.json();
            expect(rejectedBody.data.some((c: ClaimResponse) => c.id === claimId)).toBe(
                true
            );
        });
    });
});
