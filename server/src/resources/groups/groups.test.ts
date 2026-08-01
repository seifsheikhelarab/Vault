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

        it('returns empty array when user belongs to no groups', async () => {
            const user = getSecondUser(); // secondUser hasn't created any groups yet
            const res = await app.request('/api/groups', {
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data).toEqual([]);
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
            expect(body.data.some((g: GroupResponse) => g.name === 'My Group')).toBe(
                true
            );
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

        it('returns 400 for name exceeding 100 chars', async () => {
            const user = getTestUser();
            const res = await app.request('/api/groups', {
                method: 'POST',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ name: 'x'.repeat(101) })
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

            // Verify the user can update the group (admin check passes)
            const updateRes = await app.request(`/api/groups/${group.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ name: 'Updated Name' })
            });
            expect(updateRes.status).toBe(200);
        });
    });

    // ── GET /api/groups/:id ────────────────────────────────────────
    describe('GET /api/groups/:id', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups/some-id');
            expect(res.status).toBe(401);
        });

        it('returns 403 when not a member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Private Group'
            });

            const res = await app.request(`/api/groups/${group.id}`, {
                headers: getAuthHeaders(secondUser.id)
            });
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe('FORBIDDEN');
        });

        it('returns 200 and group data for a member', async () => {
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

    // ── PATCH /api/groups/:id ──────────────────────────────────────
    describe('PATCH /api/groups/:id', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups/some-id', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Hack' })
            });
            expect(res.status).toBe(401);
        });

        it('returns 403 when not a member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Protected Group'
            });

            const res = await app.request(`/api/groups/${group.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(secondUser.id),
                body: JSON.stringify({ name: 'Hacked' })
            });
            expect(res.status).toBe(403);
        });

        it('returns 403 when a regular member (not admin)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Member Group'
            });

            // Add secondUser as a regular member
            await addMember(group.id, secondUser.id);

            const res = await app.request(`/api/groups/${group.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(secondUser.id),
                body: JSON.stringify({ name: 'Should Not Work' })
            });
            expect(res.status).toBe(403);
        });

        it('returns 200 and updates the group name (admin)', async () => {
            const user = getTestUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Renamable'
            });

            const res = await app.request(`/api/groups/${group.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ name: 'Renamed' })
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.name).toBe('Renamed');
        });

        it('returns 200 and updates the group kind (admin)', async () => {
            const user = getTestUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Recategorizable',
                kind: 'social'
            });

            const res = await app.request(`/api/groups/${group.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(user.id),
                body: JSON.stringify({ kind: 'department' })
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.kind).toBe('department');
        });
    });

    // ── DELETE /api/groups/:id ─────────────────────────────────────
    describe('DELETE /api/groups/:id', () => {
        it('returns 401 when not authenticated', async () => {
            const res = await app.request('/api/groups/some-id', {
                method: 'DELETE'
            });
            expect(res.status).toBe(401);
        });

        it('returns 403 when not a member', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const { body: group } = await createGroup(user.id, {
                name: 'To Delete'
            });

            const res = await app.request(`/api/groups/${group.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(secondUser.id)
            });
            expect(res.status).toBe(403);
        });

        it('returns 403 when a regular member (not admin)', async () => {
            const user = getTestUser();
            const secondUser = getSecondUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Admin Only'
            });

            // Add secondUser as a regular member
            await addMember(group.id, secondUser.id);

            const res = await app.request(`/api/groups/${group.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(secondUser.id)
            });
            expect(res.status).toBe(403);
        });

        it('returns 200 and deletes the group (admin)', async () => {
            const user = getTestUser();
            const { body: group } = await createGroup(user.id, {
                name: 'Delete Me'
            });

            const res = await app.request(`/api/groups/${group.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(user.id)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.deleted).toBe(true);

            // Verify the group is gone — the membership is cascade-deleted too,
            // so the GET handler returns 403 (not a member) instead of 404.
            const getRes = await app.request(`/api/groups/${group.id}`, {
                headers: getAuthHeaders(user.id)
            });
            // After deleting the group, the membership is cascade-deleted,
            // so the user is no longer a member → 403 is correct behavior
            expect([403, 404]).toContain(getRes.status);
        });
    });
});
