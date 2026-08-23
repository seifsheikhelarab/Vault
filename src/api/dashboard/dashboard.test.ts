import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '../../config/rate-limit';
import { registerUser } from '../../test/fixtures';
import { buildApp, truncateAll } from '../../test/helpers';

// Dashboard resource tests (ticket #11): one snapshot composing month/week
// totals with previous-period deltas, budget progress, and the five most
// recent live expenses — through app.request() against real Postgres.
// All boundaries are Africa/Cairo wall-clock, UTC+2 across every fixture
// month here (Egypt DST starts late April), so:
//   Feb 2026 month = [Jan 31 22:00Z, Feb 28 22:00Z)
//   Week of Feb 18 = [Feb 15 22:00Z, Feb 22 22:00Z), prior week ends Feb 15 22:00Z
//   Cairo Mar 1 00:30 = Feb 28 22:30Z: March month starts Feb 28 22:00Z,
//     and the week containing it runs [Feb 22 22:00Z, Mar 1 22:00Z)

const t = buildApp();

beforeEach(async () => {
    resetRateLimits();
    await truncateAll(t.db);
});

afterEach(async () => {
    await t.db.$disconnect();
});

async function createExpense(
    headers: Headers,
    input: { amountMinor: number; occurredAt: string; categoryId?: string; note?: string },
): Promise<string> {
    const res = await t.request('/api/expenses', {
        method: 'POST',
        headers: (() => {
            const h = new Headers(headers);
            h.set('content-type', 'application/json');
            return h;
        })(),
        body: JSON.stringify({ id: crypto.randomUUID(), ...input }),
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
}

type DashboardBody = {
    month: { total: number; previous: { total: number; delta: number; deltaPct: number | null } };
    week: { total: number; previous: { total: number; delta: number; deltaPct: number | null } };
    budgets: {
        id: string;
        periodType: 'week' | 'month';
        categoryId: string | null;
        spent: number;
        limit: number;
        pct: number;
    }[];
    recentExpenses: {
        id: string;
        amountMinor: number;
        currency: string;
        categoryId: string | null;
        occurredAt: string;
        note: string | null;
    }[];
};

async function getDashboard(
    path: string,
    headers: Headers,
): Promise<{ res: Response; body: DashboardBody }> {
    const res = await t.request(path, { headers });
    return { res, body: (await res.json()) as DashboardBody };
}

describe('GET /api/dashboard', () => {
    it('returns the zero shape on an empty account', async () => {
        const { headers } = await registerUser(t);

        const { res, body } = await getDashboard(
            '/api/dashboard?date=2026-02-18T12:00:00Z',
            headers,
        );
        expect(res.status).toBe(200);
        expect(body.month).toEqual({ total: 0, previous: { total: 0, delta: 0, deltaPct: null } });
        expect(body.week).toEqual({ total: 0, previous: { total: 0, delta: 0, deltaPct: null } });
        expect(body.budgets).toEqual([]);
        expect(body.recentExpenses).toEqual([]);
    });

    it('totals month and week with correct deltas across the tz boundary', async () => {
        const { headers } = await registerUser(t);

        // Previous month (January).
        await createExpense(headers, { amountMinor: 100000, occurredAt: '2026-01-20T12:00:00Z' });
        // This month, prior week (week of Feb 9).
        await createExpense(headers, { amountMinor: 12000, occurredAt: '2026-02-12T12:00:00Z' });
        // This month, this week (week of Feb 16).
        await createExpense(headers, { amountMinor: 7000, occurredAt: '2026-02-17T12:00:00Z' });
        // Wall clock 2026-03-01T00:30+02:00 == 2026-02-28T22:30Z: Cairo says March,
        // so it sits outside February AND outside the week of Feb 16.
        expect(Date.parse('2026-03-01T00:30:00+02:00')).toBe(Date.parse('2026-02-28T22:30:00Z'));
        await createExpense(headers, { amountMinor: 40000, occurredAt: '2026-02-28T22:30:00Z' });

        const feb = await getDashboard('/api/dashboard?date=2026-02-18T12:00:00Z', headers);
        expect(feb.res.status).toBe(200);
        expect(feb.body.month).toEqual({
            total: 19000,
            previous: { total: 100000, delta: -81000, deltaPct: -81 },
        });
        expect(feb.body.week).toEqual({
            total: 7000,
            previous: { total: 12000, delta: -5000, deltaPct: -41.67 },
        });

        const mar = await getDashboard('/api/dashboard?date=2026-02-28T22:30:00Z', headers);
        expect(mar.body.month).toEqual({
            total: 40000,
            previous: { total: 19000, delta: 21000, deltaPct: 110.53 },
        });
        expect(mar.body.week).toEqual({
            total: 40000,
            previous: { total: 7000, delta: 33000, deltaPct: 471.43 },
        });
    });

    it('includes each budget spent-vs-limit progress for its current period', async () => {
        const { headers } = await registerUser(t);

        const catsRes = await t.request('/api/categories', { headers });
        const groceries = ((await catsRes.json()) as { id: string; name: string }[])[0];

        // Overall monthly cap, created first → deterministic ordering.
        await t.request('/api/budgets', {
            method: 'POST',
            headers: (() => {
                const h = new Headers(headers);
                h.set('content-type', 'application/json');
                return h;
            })(),
            body: JSON.stringify({ periodType: 'month', amountMinor: 100000 }),
        });
        // Groceries weekly cap.
        await t.request('/api/budgets', {
            method: 'POST',
            headers: (() => {
                const h = new Headers(headers);
                h.set('content-type', 'application/json');
                return h;
            })(),
            body: JSON.stringify({
                periodType: 'week',
                amountMinor: 50000,
                categoryId: groceries.id,
            }),
        });

        // Uncategorized, monthly window only.
        await createExpense(headers, { amountMinor: 30000, occurredAt: '2026-02-10T12:00:00Z' });
        // Groceries, both windows (inside the Feb 16 week).
        await createExpense(headers, {
            amountMinor: 7000,
            occurredAt: '2026-02-17T12:00:00Z',
            categoryId: groceries.id,
        });

        const { body } = await getDashboard('/api/dashboard?date=2026-02-18T12:00:00Z', headers);
        expect(body.budgets).toEqual([
            {
                id: expect.any(String),
                periodType: 'month',
                categoryId: null,
                spent: 37000,
                limit: 100000,
                pct: 37,
            },
            {
                id: expect.any(String),
                periodType: 'week',
                categoryId: groceries.id,
                spent: 7000,
                limit: 50000,
                pct: 14,
            },
        ]);
    });

    it('lists the 5 most recent expenses newest-first, excluding tombstones', async () => {
        const { headers } = await registerUser(t);

        const ids: string[] = [];
        for (let day = 1; day <= 7; day++) {
            ids.push(
                await createExpense(headers, {
                    amountMinor: day * 1000,
                    occurredAt: `2026-02-0${day}T12:00:00Z`,
                    ...(day === 6 && { note: 'latte' }),
                }),
            );
        }
        // Remove the newest and an older middle entry.
        expect(
            (await t.request(`/api/expenses/${ids[6]}`, { method: 'DELETE', headers })).status,
        ).toBe(204);
        expect(
            (await t.request(`/api/expenses/${ids[2]}`, { method: 'DELETE', headers })).status,
        ).toBe(204);

        const { body } = await getDashboard('/api/dashboard?date=2026-02-18T12:00:00Z', headers);
        expect(body.recentExpenses.map((e) => e.id)).toEqual([
            ids[5],
            ids[4],
            ids[3],
            ids[1],
            ids[0],
        ]);
        expect(body.recentExpenses[0]).toEqual({
            id: ids[5],
            amountMinor: 6000,
            currency: 'EGP',
            categoryId: null,
            occurredAt: '2026-02-06T12:00:00.000Z',
            note: 'latte',
        });
    });
});

describe('auth and validation', () => {
    it('401s without a session', async () => {
        const res = await t.request('/api/dashboard');
        expect(res.status).toBe(401);
    });

    it('422s a malformed date', async () => {
        const { headers } = await registerUser(t);
        const res = await t.request('/api/dashboard?date=not-a-date', { headers });
        expect(res.status).toBe(422);
    });
});
