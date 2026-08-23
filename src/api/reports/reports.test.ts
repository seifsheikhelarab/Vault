import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '../../config/rate-limit';
import { registerUser } from '../../test/fixtures';
import { buildApp, truncateAll } from '../../test/helpers';

// Reports resource tests (ticket #10): weekly/monthly totals with
// per-category breakdowns and previous-period deltas, through app.request()
// against real Postgres. All boundaries below are Africa/Cairo wall-clock,
// which is UTC+2 across every fixture month here (Egypt DST starts late
// April), so:
//   Feb 2026 month = [Jan 31 22:00Z, Feb 28 22:00Z)
//   Week of Feb 18 = [Feb 15 22:00Z, Feb 22 22:00Z)

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
    input: { amountMinor: number; occurredAt: string; categoryId?: string },
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

type ReportBody = {
    period: { start: string; end: string };
    total: number;
    byCategory: { categoryId: string; name: string; total: number }[];
    previous: { total: number; delta: number; deltaPct: number | null };
};

async function getReport(
    path: string,
    headers: Headers,
): Promise<{ res: Response; body: ReportBody }> {
    const res = await t.request(path, { headers });
    return { res, body: (await res.json()) as ReportBody };
}

async function categoryAt(headers: Headers, index: number): Promise<{ id: string; name: string }> {
    const res = await t.request('/api/categories', { headers });
    expect(res.status).toBe(200);
    const categories = (await res.json()) as { id: string; name: string }[];
    return categories[index];
}

describe('GET /api/reports/monthly', () => {
    it('totals live expenses per category with previous-month delta', async () => {
        const { headers } = await registerUser(t);
        const groceries = await categoryAt(headers, 0);
        const transport = await categoryAt(headers, 1);

        await createExpense(headers, {
            amountMinor: 30000,
            occurredAt: '2026-02-10T12:00:00Z',
            categoryId: groceries.id,
        });
        await createExpense(headers, {
            amountMinor: 12000,
            occurredAt: '2026-02-20T12:00:00Z',
            categoryId: transport.id,
        });
        // Uncategorized: counts in total, absent from byCategory.
        await createExpense(headers, { amountMinor: 5000, occurredAt: '2026-02-15T12:00:00Z' });
        // Tombstoned: excluded everywhere.
        const tombstoned = await createExpense(headers, {
            amountMinor: 99000,
            occurredAt: '2026-02-15T12:00:00Z',
            categoryId: groceries.id,
        });
        const del = await t.request(`/api/expenses/${tombstoned}`, { method: 'DELETE', headers });
        expect(del.status).toBe(204);
        // Previous month only.
        await createExpense(headers, {
            amountMinor: 100000,
            occurredAt: '2026-01-20T12:00:00Z',
            categoryId: groceries.id,
        });

        const { res, body } = await getReport(
            '/api/reports/monthly?date=2026-02-18T12:00:00Z',
            headers,
        );
        expect(res.status).toBe(200);
        expect(body.period).toEqual({
            start: '2026-01-31T22:00:00.000Z',
            end: '2026-02-28T22:00:00.000Z',
        });
        expect(body.total).toBe(47000);
        expect(body.byCategory).toEqual([
            { categoryId: groceries.id, name: groceries.name, total: 30000 },
            { categoryId: transport.id, name: transport.name, total: 12000 },
        ]);
        expect(body.previous).toEqual({ total: 100000, delta: -53000, deltaPct: -53 });
    });
});

describe('GET /api/reports/weekly', () => {
    it('splits expenses across the Monday boundary on the Cairo calendar', async () => {
        const { headers } = await registerUser(t);
        const groceries = await categoryAt(headers, 0);
        const transport = await categoryAt(headers, 1);

        // Sunday Feb 15 23:30 Cairo → PRIOR week.
        await createExpense(headers, { amountMinor: 12000, occurredAt: '2026-02-15T21:30:00Z' });
        // Monday Feb 16 00:05 Cairo → this week, though its UTC instant reads Feb 15.
        await createExpense(headers, {
            amountMinor: 7000,
            occurredAt: '2026-02-15T22:05:00Z',
            categoryId: groceries.id,
        });
        await createExpense(headers, {
            amountMinor: 20000,
            occurredAt: '2026-02-19T10:00:00Z',
            categoryId: transport.id,
        });

        const { res, body } = await getReport(
            '/api/reports/weekly?date=2026-02-18T12:00:00Z',
            headers,
        );
        expect(res.status).toBe(200);
        expect(body.period).toEqual({
            start: '2026-02-15T22:00:00.000Z',
            end: '2026-02-22T22:00:00.000Z',
        });
        expect(body.total).toBe(27000);
        expect(body.byCategory).toEqual([
            { categoryId: transport.id, name: transport.name, total: 20000 },
            { categoryId: groceries.id, name: groceries.name, total: 7000 },
        ]);
        expect(body.previous.total).toBe(12000);
        expect(body.previous.delta).toBe(15000);
        expect(body.previous.deltaPct).toBe(125);
    });
});

describe('Cairo timezone pin', () => {
    it('buckets an expense by wall clock, not UTC instant', async () => {
        const { headers } = await registerUser(t);

        // Wall clock 2026-03-01T00:30+02:00; UTC instant 2026-02-28T22:30Z —
        // different instants, same moment. The UTC date reads "February", the
        // Cairo calendar says March 1.
        expect(Date.parse('2026-03-01T00:30:00+02:00')).toBe(Date.parse('2026-02-28T22:30:00Z'));
        await createExpense(headers, { amountMinor: 40000, occurredAt: '2026-02-28T22:30:00Z' });

        // February report: excludes it — Cairo March already began at 22:00Z.
        const feb = await getReport('/api/reports/monthly?date=2026-02-27T12:00:00Z', headers);
        expect(feb.body.period.end).toBe('2026-02-28T22:00:00.000Z');
        expect(feb.body.total).toBe(0);

        // March report: includes it, starting where Cairo March starts.
        const mar = await getReport('/api/reports/monthly?date=2026-03-05T12:00:00Z', headers);
        expect(mar.body.period.start).toBe('2026-02-28T22:00:00.000Z');
        expect(mar.body.total).toBe(40000);
    });
});

describe('empty periods and zero baselines', () => {
    it('returns zeros and null deltaPct when nothing exists', async () => {
        const { headers } = await registerUser(t);

        const { res, body } = await getReport(
            '/api/reports/monthly?date=2030-06-15T12:00:00Z',
            headers,
        );
        expect(res.status).toBe(200);
        expect(body.total).toBe(0);
        expect(body.byCategory).toEqual([]);
        expect(body.previous).toEqual({ total: 0, delta: 0, deltaPct: null });
    });

    it('keeps deltaPct null when only the previous period is empty', async () => {
        const { headers } = await registerUser(t);
        await createExpense(headers, { amountMinor: 8000, occurredAt: '2026-02-10T12:00:00Z' });

        const { body } = await getReport('/api/reports/monthly?date=2026-02-18T12:00:00Z', headers);
        expect(body.total).toBe(8000);
        expect(body.previous).toEqual({ total: 0, delta: 8000, deltaPct: null });
    });
});

describe('auth and validation', () => {
    it('401s without a session', async () => {
        const weekly = await t.request('/api/reports/weekly');
        const monthly = await t.request('/api/reports/monthly');
        expect(weekly.status).toBe(401);
        expect(monthly.status).toBe(401);
    });

    it('422s a malformed date', async () => {
        const { headers } = await registerUser(t);
        const res = await t.request('/api/reports/weekly?date=not-a-date', { headers });
        expect(res.status).toBe(422);
    });
});
