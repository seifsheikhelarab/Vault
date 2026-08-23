import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, truncateAll } from './helpers';

// Smoke test for the Vitest harness itself (ticket #4): real Hono app via
// app.request() with injected bindings, against the real migrated Postgres.
// Auth wiring lands with ticket #5; until then no authed-user fixture exists.

const t = buildApp();

beforeEach(async () => {
    await truncateAll(t.db);
});

afterEach(async () => {
    await t.db.$disconnect();
});

describe('harness smoke', () => {
    it('returns the error envelope for unknown routes', async () => {
        const res = await t.request('/api/definitely-not-a-route');
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
            error: { code: 'NOT_FOUND', message: 'Not found' },
        });
    });

    it('roundtrips a user row through the test database', async () => {
        const id = crypto.randomUUID();
        await t.db.user.create({
            data: { id, name: 'Smoke', email: 'smoke@test.local' },
        });
        const found = await t.db.user.findUniqueOrThrow({ where: { id } });
        expect(found.email).toBe('smoke@test.local');
        expect(found.timeZone).toBe('Africa/Cairo');
    });
});
