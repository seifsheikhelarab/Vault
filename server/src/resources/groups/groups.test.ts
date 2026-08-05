import { describe, it, expect } from 'vitest';
import {
    app,
    getTestUser,
    getSecondUser,
    getAuthHeaders
} from '../../test/setup';
import { db } from '../../lib/db';
import { memberships } from '../../lib/db/schema';
import { eq, and } from 'drizzle-orm';

/** JSON shape of a group from GET /api/groups */
interface GroupResponse {
    name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a group and returns its data.
 */
async function createGroup(
    userId: string,
    overrides: Partial<{ name: string; kind: string }> = {}
) {
    const res = await app.request('/api/groups', {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({
            name: 'Test Group',
            kind: 'social',
            ...overrides
        })
    });
    const body = await res.json();
    return { res, body: body.data };
}

/**
 * Adds a user as a regular member of a group via direct DB insert.
 * Returns the membership record.
 */
async function addMember(groupId: string, userId: string) {
    const [existing] = await db
        .select()
        .from(memberships)
        .where(
            and(
                eq(memberships.groupId, groupId),
                eq(memberships.userId, userId)
            )
        );

    if (existing) return existing;

    const [membership] = await db
        .insert(memberships)
        .values({ id: crypto.randomUUID(), groupId, userId, role: 'member' })
        .returning();
    return membership;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Groups API', () => {
    // ── GET /api/groups ────────────────────────────────────────────
    describe('GET /api/groups', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups');
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('returns groups the user belongs to', async () => {
            const user = getTestUser();
            await createGroup(user.id, { name: 'My Group' });

            const res = await app.request('/api/groups', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data)).toBe(true);
            expect(
                body.data.some((g: GroupResponse) => g.name === 'My Group')
            ).toBe(true);
        });
    });

    // ── POST /api/groups ───────────────────────────────────────────
    describe('POST /api/groups', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test' })
            });
            expect(res.status).toBe(401);
        });

        it('returns 400 for missing name', async () => {
            const user = getTestUser();
            const res = await app.request('/api/groups', {
                method: 'POST',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({})
            });
            expect(res.status).toBe(400);
        });

        it('returns 400 for empty name', async () => {
            const user = getTestUser();
            const res = await app.request('/api/groups', {
                method: 'POST',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ name: '' })
            });
            expect(res.status).toBe(400);
        });

        it('returns 400 for invalid kind', async () => {
            const user = getTestUser();
            const res = await app.request('/api/groups', {
                method: 'POST',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ name: 'Test', kind: 'invalid' })
            });
            expect(res.status).toBe(400);
        });

        it('returns 201 and creates group with valid data', async () => {
            const user = getTestUser();
            const { res, body } = await createGroup(user.id, {
                name: 'Fresh Group'
            });

            expect(res.status).toBe(201);
            expect(body).toBeDefined();
            expect(body.name).toBe('Fresh Group');
            expect(body.kind).toBe('social');
            expect(body.createdBy).toBe(user.id);
            expect(body.id).toBeDefined();
        });

        it("returns 201 with kind='department' when specified", async () => {
            const user = getTestUser();
            const { body } = await createGroup(user.id, {
                name: 'Engineering',
                kind: 'department'
            });

            expect(body.kind).toBe('department');
        });

        it('auto-adds creator as admin member', async () => {
            const user = getTestUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Admin Test'
            });

            // Verify the creator is an admin membership
            const [membership] = await db
                .select()
                .from(memberships)
                .where(
                    and(
                        eq(memberships.groupId, group.id),
                        eq(memberships.userId, user.id)
                    )
                );
            expect(membership).toBeDefined();
            expect(membership.role).toBe('admin');
        });
    });

    // ── GET /api/groups/:id ────────────────────────────────────────
    describe('GET /api/groups/:id', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups/some-id');
            expect(res.status).toBe(401);
        });

        it('returns 404 for non-existent group', async () => {
            const user = getTestUser();
            const res = await app.request('/api/groups/non-existent', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(404);
        });

        it('returns 200 and group data', async () => {
            const user = getTestUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Visible Group'
            });

            const res = await app.request(`/api/groups/${group.id}`, {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.id).toBe(group.id);
            expect(body.data.name).toBe('Visible Group');
        });
    });

    // ── POST /api/groups/:id/close ─────────────────────────────────
    describe('POST /api/groups/:id/close', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups/some-id/close', {
                method: 'POST'
            });
            expect(res.status).toBe(401);
        });

        it('returns 400 when a non-owner attempts to close', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Protected Group'
            });
            await addMember(group.id, secondUser.id);

            const res = await app.request(`/api/groups/${group.id}/close`, {
                method: 'POST',
                headers: getAuthHeaders(secondUser.id)
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });

        it('closes the group when the owner acts', async () => {
            const user = getTestUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Close Me'
            });

            const res = await app.request(`/api/groups/${group.id}/close`, {
                method: 'POST',
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.closed).toBe(true);
            expect(body.data.closedAt).toBeDefined();
        });

        it('returns 400 when closing an already-closed group', async () => {
            const user = getTestUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Double Close'
            });

            await app.request(`/api/groups/${group.id}/close`, {
                method: 'POST',
                headers: getAuthHeaders(user.id)
            });
            const res = await app.request(`/api/groups/${group.id}/close`, {
                method: 'POST',
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(400);
        });
    });

    // ── GET /api/groups/summary ────────────────────────────────────
    describe('GET /api/groups/summary', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups/summary');
            expect(res.status).toBe(401);
        });

        it('returns a summary object', async () => {
            const user = getTestUser();
            const res = await app.request('/api/groups/summary', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(Array.isArray(body.data.departments)).toBe(true);
            expect(typeof body.data.totalBudget).toBe('number');
            expect(typeof body.data.totalSpent).toBe('number');
        });
    });
});
