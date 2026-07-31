import { describe, it, expect } from 'vitest';
import { ClaimService } from './claim.service';
import { db } from '../../lib/db';
import { claims, expenses, groups, memberships } from '../../lib/db/schema';
import { getTestUser, getSecondUser, getTestCategory } from '../../test/setup';

const service = new ClaimService();

// ── Helpers ──────────────────────────────────────────────────────────

async function createDepartmentWithMember(adminId: string, memberId: string) {
    const groupId = crypto.randomUUID();
    await db.insert(groups).values({
        id: groupId, name: 'Claim Service Dept', kind: 'department', createdBy: adminId
    });
    await db.insert(memberships).values([
        { id: crypto.randomUUID(), groupId, userId: adminId, role: 'admin' },
        { id: crypto.randomUUID(), groupId, userId: memberId, role: 'member' }
    ]);
    return { id: groupId };
}

async function createGroupExpense(userId: string, groupId: string) {
    const category = getTestCategory();
    const expenseId = crypto.randomUUID();
    await db.insert(expenses).values({
        id: expenseId,
        amount: '100.00',
        description: 'Service test expense',
        categoryId: category.id,
        userId,
        groupId,
        scope: 'company',
        date: new Date()
    });
    return { id: expenseId, userId };
}

async function createClaimDirect(expenseId: string) {
    const id = crypto.randomUUID();
    await db.insert(claims).values({ id, expenseId });
    return { id };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ClaimService', () => {
    // ── create ────────────────────────────────────────────────────
    describe('create', () => {
        it('returns NOT_FOUND when expense does not exist', async () => {
            const user = getTestUser();
            const result = await service.create(user.id, { expenseId: 'non-existent' });
            expect(result).toEqual({ error: 'NOT_FOUND' });
        });

        it("returns FORBIDDEN when expense doesn't belong to user", async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const dept = await createDepartmentWithMember(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, dept.id);
            const result = await service.create(secondUser.id, { expenseId: exp.id });
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns CONFLICT when already claimed', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            await createClaimDirect(exp.id);
            const result = await service.create(user.id, { expenseId: exp.id });
            expect(result).toEqual({ error: 'CONFLICT' });
        });

        it('returns a claim with status "submitted"', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const result = await service.create(user.id, { expenseId: exp.id });

            expect(result).not.toHaveProperty('error');
            const claim = result as any;
            expect(claim.expenseId).toBe(exp.id);
            expect(claim.status).toBe('submitted');
            expect(claim.id).toBeDefined();
        });
    });

    // ── list ──────────────────────────────────────────────────────
    describe('list', () => {
        it('returns FORBIDDEN for non-member group filter', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const dept = await createDepartmentWithMember(user.id, secondUser.id);
            // Create a third user who's not a member
            const result = await service.list('non-existent-user', { groupId: dept.id });
            expect(result).toEqual({ error: 'FORBIDDEN' });
        });

        it('returns claims for all department groups user belongs to', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const dept = await createDepartmentWithMember(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, dept.id);
            await createClaimDirect(exp.id);

            const result = await service.list(user.id, {});
            expect(Array.isArray(result)).toBe(true);
            const listResult = result as any[];
            expect(listResult.length).toBeGreaterThanOrEqual(1);
            expect(listResult[0].expense).toBeDefined();
            expect(listResult[0].expense.id).toBe(exp.id);
        });

        it('filters by status correctly', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            await createClaimDirect(exp.id);

            const result = await service.list(user.id, { status: 'submitted' });
            const listResult = result as any[];
            expect(listResult.every((c: any) => c.status === 'submitted')).toBe(true);

            const empty = await service.list(user.id, { status: 'approved' });
            expect(empty).toEqual([]);
        });
    });

    // ── approve ───────────────────────────────────────────────────
    describe('approve', () => {
        it('returns null for non-existent claim', async () => {
            const result = await service.approve(getTestUser().id, 'non-existent');
            expect(result).toBeNull();
        });

        it('approves claim and sets reviewerId', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            const result = await service.approve(user.id, claim.id);
            expect(result).not.toBeNull();
            const approved = result as any;
            expect(approved.status).toBe('approved');
            expect(approved.reviewerId).toBe(user.id);
            expect(approved.reviewedAt).toBeDefined();
        });
    });

    // ── reject ────────────────────────────────────────────────────
    describe('reject', () => {
        it('returns null for non-existent claim', async () => {
            const result = await service.reject(getTestUser().id, 'non-existent', {});
            expect(result).toBeNull();
        });

        it('rejects with a note', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            const result = await service.reject(user.id, claim.id, { note: 'Bad receipt' });
            const rejected = result as any;
            expect(rejected.status).toBe('rejected');
            expect(rejected.reviewNote).toBe('Bad receipt');
            expect(rejected.reviewedAt).toBeDefined();
        });

        it('rejects without a note (note is null)', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            const result = await service.reject(user.id, claim.id, {});
            const rejected = result as any;
            expect(rejected.status).toBe('rejected');
            expect(rejected.reviewNote).toBeNull();
        });
    });

    // ── reimburse ─────────────────────────────────────────────────
    describe('reimburse', () => {
        it('returns null for non-existent claim', async () => {
            const result = await service.reimburse(getTestUser().id, 'non-existent');
            expect(result).toBeNull();
        });

        it('marks claim as reimbursed', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            const result = await service.reimburse(user.id, claim.id);
            const reimbursed = result as any;
            expect(reimbursed.status).toBe('reimbursed');
            expect(reimbursed.reviewerId).toBe(user.id);
        });
    });

    // ── State-machine edge cases ──────────────────────────────────
    describe('state machine edges', () => {
        it('reimbursing a non-approved claim succeeds (no guard)', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            // Reimburse without approving first — service allows it
            const result = await service.reimburse(user.id, claim.id);
            expect((result as any).status).toBe('reimbursed');
        });

        it('double-approving overwrites reviewer info', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const dept = await createDepartmentWithMember(user.id, secondUser.id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            await service.approve(user.id, claim.id);
            // Second user also approves (overwrites)
            const result = await service.approve(secondUser.id, claim.id);
            expect((result as any).status).toBe('approved');
            expect((result as any).reviewerId).toBe(secondUser.id);
        });

        it('approving a rejected claim transitions back to approved', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            await service.reject(user.id, claim.id, { note: 'Bad' });
            const result = await service.approve(user.id, claim.id);
            expect((result as any).status).toBe('approved');
            // approve() does not clear reviewNote — it persists from reject
            expect((result as any).reviewNote).toBe('Bad');
        });

        it('reimbursing an already-reimbursed claim is idempotent', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);
            const claim = await createClaimDirect(exp.id);

            await service.reimburse(user.id, claim.id);
            const result = await service.reimburse(user.id, claim.id);
            expect((result as any).status).toBe('reimbursed');
        });
    });

    // ── Full workflow ─────────────────────────────────────────────
    describe('workflow', () => {
        it('completes the full submit → approve → reimburse lifecycle', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);

            const claimResult = await service.create(user.id, { expenseId: exp.id });
            const claim = claimResult as any;
            expect(claim.status).toBe('submitted');

            const approved = await service.approve(user.id, claim.id);
            expect((approved as any).status).toBe('approved');

            const reimbursed = await service.reimburse(user.id, claim.id);
            expect((reimbursed as any).status).toBe('reimbursed');
        });

        it('completes the submit → reject workflow', async () => {
            const user = getTestUser();
            const dept = await createDepartmentWithMember(user.id, getSecondUser().id);
            const exp = await createGroupExpense(user.id, dept.id);

            const claimResult = await service.create(user.id, { expenseId: exp.id });
            const claim = claimResult as any;
            expect(claim.status).toBe('submitted');

            const rejected = await service.reject(user.id, claim.id, { note: 'Invalid' });
            expect((rejected as any).status).toBe('rejected');
            expect((rejected as any).reviewNote).toBe('Invalid');
        });
    });
});
