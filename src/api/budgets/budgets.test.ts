import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimits } from '../../config/rate-limit'
import { registerUser } from '../../test/fixtures'
import { buildApp, truncateAll } from '../../test/helpers'

// Budgets resource tests (ticket #8): CRUD validation, spent-vs-limit
// progress with Cairo-calendar week/month boundaries, tombstone exclusion,
// and scoped-vs-overall sums — through app.request() against real Postgres.

const t = buildApp()

beforeEach(async () => {
  resetRateLimits()
  await truncateAll(t.db)
})

afterEach(async () => {
  await t.db.$disconnect()
})

/** JSON request with the fixture's session cookie attached. */
function json(
  t: ReturnType<typeof buildApp>,
  path: string,
  headers: Headers,
  method: string,
  body?: string,
): Promise<Response> {
  const h = new Headers(headers)
  h.set('content-type', 'application/json')
  return t.request(path, { method, headers: h, body })
}

type BudgetBody = {
  periodType: 'week' | 'month'
  amountMinor: number
  categoryId?: string | null
}

async function createBudget(
  headers: Headers,
  overrides: Partial<BudgetBody> = {},
): Promise<Record<string, unknown> & { id: string }> {
  const body = { periodType: 'month' as const, amountMinor: 100000, ...overrides }
  const res = await json(t, '/api/budgets', headers, 'POST', JSON.stringify(body))
  expect(res.status).toBe(201)
  return (await res.json()) as Record<string, unknown> & { id: string }
}

async function categoryAt(headers: Headers, index: number): Promise<{ id: string; name: string }> {
  const res = await t.request('/api/categories', { headers })
  expect(res.status).toBe(200)
  const categories = (await res.json()) as { id: string; name: string }[]
  return categories[index]
}

async function createExpense(
  headers: Headers,
  input: { amountMinor: number; occurredAt: string; categoryId?: string },
): Promise<string> {
  const res = await json(
    t,
    '/api/expenses',
    headers,
    'POST',
    JSON.stringify({ id: crypto.randomUUID(), ...input }),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

describe('POST /api/budgets', () => {
  it('creates an overall budget scoped to the user', async () => {
    const { user, headers } = await registerUser(t)

    const created = await createBudget(headers, { amountMinor: 500000 })
    expect(created.periodType).toBe('month')
    expect(created.amountMinor).toBe(500000)
    expect(created.categoryId).toBeNull()

    const row = await t.db.budget.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.userId).toBe(user.id)
    expect(row.amountMinor).toBe(BigInt(500000))
  })

  it('creates a category-scoped budget with an owned categoryId', async () => {
    const { headers } = await registerUser(t)
    const groceries = await categoryAt(headers, 0)

    const created = await createBudget(headers, {
      periodType: 'week',
      amountMinor: 40000,
      categoryId: groceries.id,
    })
    expect(created.categoryId).toBe(groceries.id)
  })

  it('allows multiple concurrently active budgets', async () => {
    const { headers } = await registerUser(t)
    const groceries = await categoryAt(headers, 0)
    const transport = await categoryAt(headers, 1)

    await createBudget(headers, { amountMinor: 1 })
    await createBudget(headers, { amountMinor: 2, categoryId: groceries.id })
    await createBudget(headers, { periodType: 'week', amountMinor: 3, categoryId: transport.id })

    const list = (await (await t.request('/api/budgets', { headers })).json()) as unknown[]
    expect(list).toHaveLength(3)
  })

  it.each([
    ['bad periodType', { periodType: 'year', amountMinor: 100 }],
    ['zero amountMinor', { periodType: 'month', amountMinor: 0 }],
    ['negative amountMinor', { periodType: 'month', amountMinor: -5 }],
    ['fractional amountMinor', { periodType: 'month', amountMinor: 10.5 }],
    ['missing amountMinor', { periodType: 'week' }],
    ['unknown field value for category', { periodType: 'month', amountMinor: 100, categoryId: 'nope' }],
  ])('422s on %s', async (_label, body) => {
    const { headers } = await registerUser(t)
    const res = await json(t, '/api/budgets', headers, 'POST', JSON.stringify(body))
    expect(res.status).toBe(422)
    expect(await t.db.budget.count()).toBe(0)
  })

  it('404s when categoryId belongs to another user', async () => {
    const other = await registerUser(t)
    const foreignCategory = await categoryAt(other.headers, 0)

    const { headers } = await registerUser(t)
    const res = await json(
      t,
      '/api/budgets',
      headers,
      'POST',
      JSON.stringify({ periodType: 'month', amountMinor: 100, categoryId: foreignCategory.id }),
    )
    expect(res.status).toBe(404)
  })
})

describe('GET/PATCH/DELETE /api/budgets/:id', () => {
  it('gets one owned budget', async () => {
    const { headers } = await registerUser(t)
    const created = await createBudget(headers)

    const res = await t.request(`/api/budgets/${created.id}`, { headers })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { id: string }).id).toBe(created.id)
  })

  it('patches amount, periodType, and clears categoryId via null', async () => {
    const { headers } = await registerUser(t)
    const groceries = await categoryAt(headers, 0)
    let budget = await createBudget(headers, { categoryId: groceries.id })

    let res = await json(
      t,
      `/api/budgets/${budget.id}`,
      headers,
      'PATCH',
      JSON.stringify({ amountMinor: 999, periodType: 'week' }),
    )
    expect(res.status).toBe(200)
    budget = (await res.json()) as typeof budget
    expect(budget.amountMinor).toBe(999)
    expect(budget.periodType).toBe('week')
    expect(budget.categoryId).toBe(groceries.id)

    res = await json(t, `/api/budgets/${budget.id}`, headers, 'PATCH', JSON.stringify({ categoryId: null }))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { categoryId: string | null }).categoryId).toBeNull()
  })

  it('404s a foreign budget id and a deleted id', async () => {
    const owner = await registerUser(t)
    const budget = await createBudget(owner.headers)

    const stranger = await registerUser(t)
    const foreign = await t.request(`/api/budgets/${budget.id}`, { headers: stranger.headers })
    expect(foreign.status).toBe(404)

    const del = await t.request(`/api/budgets/${budget.id}`, {
      method: 'DELETE',
      headers: owner.headers,
    })
    expect(del.status).toBe(204)

    const gone = await t.request(`/api/budgets/${budget.id}`, { headers: owner.headers })
    expect(gone.status).toBe(404)

    const again = await t.request(`/api/budgets/${budget.id}`, {
      method: 'DELETE',
      headers: owner.headers,
    })
    expect(again.status).toBe(404)
  })

  it('422s an invalid patch payload', async () => {
    const { headers } = await registerUser(t)
    const budget = await createBudget(headers)
    const res = await json(
      t,
      `/api/budgets/${budget.id}`,
      headers,
      'PATCH',
      JSON.stringify({ amountMinor: 0 }),
    )
    expect(res.status).toBe(422)
  })
})

describe('GET /api/budgets/progress', () => {
  // Fixture calendar (all boundaries on the Africa/Cairo calendar, UTC+2 in
  // February 2026):
  //   Feb month   = [Jan 31 22:00Z, Feb 28 22:00Z)
  //   Week of Feb18 = Mon Feb 16 00:00 +02 [Feb 15 22:00Z, Feb 22 22:00Z)
  // Expenses:
  //   E1 groceries 30000 Feb10        E2 uncategorized 20000 Feb20
  //   E3 groceries 99000 Feb15 (tombstoned)   E4 transport 15000 Feb12
  //   E5 overall 8000 Tue Feb17 09:00Z (in week)  E6 overall 12000 Sun Feb15 21:30Z (Sun 23:30 Cairo, prior week)
  //   E7 overall 7000 Sun Feb15 22:05Z (Mon 00:05 Cairo, in week)
  //   E8 overall 6000 Sat Feb28 21:30Z (Feb 28 23:30 Cairo)  E9 overall 5000 Feb28 22:05Z (Mar 01 00:05 Cairo → next month)
  //   E10 prev-month 500000 Jan 20 (outside February)
  const DATE = '2026-02-18T12:00:00Z'

  interface Setup {
    headers: Headers
    overall: { id: string }
    groceryBudget: { id: string; categoryId: string }
    weekly: { id: string }
  }

  async function setup(): Promise<Setup> {
    const { headers } = await registerUser(t)
    const groceries = await categoryAt(headers, 0)
    const transport = await categoryAt(headers, 1)

    const overall = await createBudget(headers, { amountMinor: 100000 })
    const groceryBudget = await createBudget(headers, {
      amountMinor: 40000,
      categoryId: groceries.id,
    })
    const weekly = await createBudget(headers, { periodType: 'week', amountMinor: 20000 })

    await createExpense(headers, { amountMinor: 30000, occurredAt: '2026-02-10T12:00:00Z', categoryId: groceries.id })
    await createExpense(headers, { amountMinor: 20000, occurredAt: '2026-02-20T12:00:00Z' })
    const tombstoned = await createExpense(headers, {
      amountMinor: 99000,
      occurredAt: '2026-02-15T12:00:00Z',
      categoryId: groceries.id,
    })
    const del = await t.request(`/api/expenses/${tombstoned}`, { method: 'DELETE', headers })
    expect(del.status).toBe(204)
    await createExpense(headers, { amountMinor: 15000, occurredAt: '2026-02-12T12:00:00Z', categoryId: transport.id })
    await createExpense(headers, { amountMinor: 8000, occurredAt: '2026-02-17T09:00:00Z' })
    await createExpense(headers, { amountMinor: 12000, occurredAt: '2026-02-15T21:30:00Z' })
    await createExpense(headers, { amountMinor: 7000, occurredAt: '2026-02-15T22:05:00Z' })
    await createExpense(headers, { amountMinor: 6000, occurredAt: '2026-02-28T21:30:00Z' })
    await createExpense(headers, { amountMinor: 5000, occurredAt: '2026-02-28T22:05:00Z' })
    await createExpense(headers, { amountMinor: 500000, occurredAt: '2026-01-20T12:00:00Z' })

    return { headers, overall, groceryBudget: { ...groceryBudget, categoryId: groceries.id }, weekly }
  }

  it('computes spent/limit/pct per active budget at the given date', async () => {
    const s = await setup()

    const res = await t.request(`/api/budgets/progress?date=${DATE}`, { headers: s.headers })
    expect(res.status).toBe(200)
    const progress = (await res.json()) as Array<{
      id: string
      periodType: string
      categoryId: string | null
      spent: number
      limit: number
      pct: number
    }>
    expect(progress).toHaveLength(3)

    const byId = new Map(progress.map((p) => [p.id, p]))

    // Overall: everything live in Feb EXCEPT tombstone + Mar-Cairo + Jan.
    // 30+20+15+8+12+7+6 = 98k of 100k.
    const o = byId.get(s.overall.id)
    expect(o).toMatchObject({ spent: 98000, limit: 100000, pct: 98, periodType: 'month', categoryId: null })

    // Grocery scope: only its own category; tombstoned grocery expense excluded. 30k of 40k.
    expect(byId.get(s.groceryBudget.id)).toMatchObject({
      spent: 30000,
      limit: 40000,
      pct: 75,
      categoryId: s.groceryBudget.categoryId,
    })

    // Week containing Feb 18 (Mon Feb 16 .. Sun Feb 22 Cairo): E2 (Thu),
    // E5 (Tue), and E7 (Mon 00:05 Cairo) land inside; E6 stays Sunday-prior.
    // 20+8+7 = 35k of 20k.
    expect(byId.get(s.weekly.id)).toMatchObject({ spent: 35000, limit: 20000, pct: 175, periodType: 'week' })
  })

  it('accepts date-only and full datetime forms identically', async () => {
    const s = await setup()
    const a = await t.request('/api/budgets/progress?date=2026-02-18', { headers: s.headers })
    const b = await t.request(`/api/budgets/progress?date=${encodeURIComponent(DATE)}`, { headers: s.headers })
    expect(a.status).toBe(200)
    expect(await a.json()).toEqual(await b.json())
  })

  it('defaults to now when date is omitted', async () => {
    const s = await setup()
    const res = await t.request('/api/budgets/progress', { headers: s.headers })
    expect(res.status).toBe(200)
    expect(Array.isArray(await res.json())).toBe(true)
  })

  it('422s a malformed date', async () => {
    const { headers } = await registerUser(t)
    const res = await t.request('/api/budgets/progress?date=not-a-date', { headers })
    expect(res.status).toBe(422)
  })

  it('isolates users: another account sees only their budgets', async () => {
    await setup()
    const b = await registerUser(t)
    const mine = await createBudget(b.headers, { amountMinor: 12345 })

    const res = await t.request(`/api/budgets/progress?date=${DATE}`, { headers: b.headers })
    const progress = (await res.json()) as Array<{ id: string; spent: number }>
    expect(progress).toHaveLength(1)
    expect(progress[0].id).toBe(mine.id)
    expect(progress[0].spent).toBe(0)
  })
})
