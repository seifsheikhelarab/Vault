import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimits } from '../../config/rate-limit'
import { fixedNow } from '../../test/helpers'
import { registerUser } from '../../test/fixtures'
import { buildApp, truncateAll } from '../../test/helpers'

// Expenses resource tests (ticket #7): idempotent create with client-minted
// ids, keyset pagination over (occurredAt DESC, id DESC), soft-delete
// tombstones — through app.request() against real Postgres.

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

type ExpenseBody = {
  id: string
  amountMinor: number
  occurredAt?: string
  categoryId?: string
  note?: string | null
}

async function createExpense(
  headers: Headers,
  overrides: Partial<ExpenseBody> = {},
): Promise<Record<string, unknown> & { id: string }> {
  const body = {
    id: crypto.randomUUID(),
    amountMinor: 2500,
    ...overrides,
  }
  const res = await json(t, '/api/expenses', headers, 'POST', JSON.stringify(body))
  expect(res.status).toBe(201)
  return (await res.json()) as Record<string, unknown> & { id: string }
}

async function firstCategory(headers: Headers): Promise<{ id: string; name: string }> {
  const res = await t.request('/api/categories', { headers })
  expect(res.status).toBe(200)
  const categories = (await res.json()) as { id: string; name: string }[]
  return categories[0]
}

describe('POST /api/expenses', () => {
  it('creates an expense with a category and note', async () => {
    const { user, headers } = await registerUser(t)
    const category = await firstCategory(headers)
    const id = crypto.randomUUID()

    const created = await createExpense(headers, {
      id,
      amountMinor: 12345,
      occurredAt: fixedNow.toISOString(),
      categoryId: category.id,
      note: 'latte',
    })
    expect(created.id).toBe(id)
    expect(created.amountMinor).toBe(12345)
    expect(created.categoryId).toBe(category.id)
    expect(created.note).toBe('latte')
    expect(created.currency).toBe('EGP')

    const row = await t.db.expense.findUniqueOrThrow({ where: { id } })
    expect(row.userId).toBe(user.id)
    // Stored exactly as minor units: bigint column, no float rounding.
    expect(row.amountMinor).toBe(BigInt(12345))
    expect(row.deletedAt).toBeNull()
  })

  it('defaults occurredAt to now when omitted', async () => {
    const { headers } = await registerUser(t)
    const before = Date.now()
    const created = await createExpense(headers)

    const row = await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.occurredAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(row.occurredAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('replays the same id + payload as success without duplicating', async () => {
    const { headers } = await registerUser(t)
    const body = { id: crypto.randomUUID(), amountMinor: 700, note: 'taxi' }

    const first = await json(t, '/api/expenses', headers, 'POST', JSON.stringify(body))
    expect(first.status).toBe(201)

    const replay = await json(t, '/api/expenses', headers, 'POST', JSON.stringify(body))
    expect(replay.status).toBe(200)
    expect(((await replay.json()) as { id: string }).id).toBe(body.id)
    expect(await t.db.expense.count()).toBe(1)
  })

  it('409s the same id with a different payload and keeps the original', async () => {
    const { headers } = await registerUser(t)
    const created = await createExpense(headers, { amountMinor: 100 })

    const conflict = await json(
      t,
      '/api/expenses',
      headers,
      'POST',
      JSON.stringify({ id: created.id, amountMinor: 200 }),
    )
    expect(conflict.status).toBe(409)
    expect(((await conflict.json()) as { error: { code: string } }).error.code).toBe('CONFLICT')
    expect((await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })).amountMinor).toBe(
      BigInt(100),
    )
  })

  it('rejects invalid amountMinor and ids with the 422 envelope', async () => {
    const { headers } = await registerUser(t)
    for (const amountMinor of [0, -5, 10.5, Number.MAX_SAFE_INTEGER + 1]) {
      const res = await json(
        t,
        '/api/expenses',
        headers,
        'POST',
        JSON.stringify({ id: crypto.randomUUID(), amountMinor }),
      )
      expect(res.status).toBe(422)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      )
    }
    const badId = await json(
      t,
      '/api/expenses',
      headers,
      'POST',
      JSON.stringify({ id: 'not-a-uuid', amountMinor: 100 }),
    )
    expect(badId.status).toBe(422)
  })

  it('rejects a foreign categoryId with 404', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)
    const foreignCategory = await firstCategory(stranger.headers)

    const res = await json(
      t,
      '/api/expenses',
      owner.headers,
      'POST',
      JSON.stringify({
        id: crypto.randomUUID(),
        amountMinor: 100,
        categoryId: foreignCategory.id,
      }),
    )
    expect(res.status).toBe(404)
    expect(await t.db.expense.count()).toBe(0)
  })

  it('requires a session', async () => {
    const res = await json(
      t,
      '/api/expenses',
      new Headers(),
      'POST',
      JSON.stringify({ id: crypto.randomUUID(), amountMinor: 100 }),
    )
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/expenses pagination', () => {
  /**
   * Seed `n` expenses at distinct, rising instants so the expected order is
   * plain reverse-creation order (no dependence on uuid collation).
   */
  async function seedRows(headers: Headers, n: number): Promise<string[]> {
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const at = new Date(fixedNow.getTime() + i * 1000)
      const created = await createExpense(headers, { occurredAt: at.toISOString() })
      ids.push(created.id)
    }
    return ids.reverse()
  }

  async function listPage(headers: Headers, query: string) {
    const res = await t.request(`/api/expenses${query}`, { headers })
    expect(res.status).toBe(200)
    return (await res.json()) as { items: { id: string }[]; nextCursor: string | null }
  }

  // 25+ sequential HTTP creates per test; each carries auth overhead.
  it('walks a cursor across more than one page of rows', { timeout: 30_000 }, async () => {
    const { headers } = await registerUser(t)
    const expectedOrder = await seedRows(headers, 25)

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page = await listPage(headers, cursor ? `?limit=10&cursor=${cursor}` : '?limit=10')
      expect(page.items.length).toBeLessThanOrEqual(10)
      seen.push(...page.items.map((e) => e.id))
      cursor = page.nextCursor
    } while (cursor !== null)

    expect(seen).toEqual(expectedOrder)
  })

  it('defaults to limit 20 and nulls nextCursor on the exact last page', { timeout: 30_000 }, async () => {
    const { headers } = await registerUser(t)
    const ids = await seedRows(headers, 20)

    const onlyPage = await listPage(headers, '')
    expect(onlyPage.items.map((e) => e.id)).toEqual(ids)
    expect(onlyPage.nextCursor).toBeNull()
  })

  it('returns 20 of 25 by default with a follow-up cursor', { timeout: 30_000 }, async () => {
    const { headers } = await registerUser(t)
    await seedRows(headers, 25)

    const firstPage = await listPage(headers, '')
    expect(firstPage.items).toHaveLength(20)
    expect(firstPage.nextCursor).not.toBeNull()

    const lastPage = await listPage(headers, `?cursor=${firstPage.nextCursor}`)
    expect(lastPage.items).toHaveLength(5)
    expect(lastPage.nextCursor).toBeNull()
  })

  it('422s a malformed cursor and an out-of-range limit', async () => {
    const { headers } = await registerUser(t)
    await seedRows(headers, 3)

    for (const query of ['?cursor=garbage', '?limit=0', '?limit=101', '?limit=abc']) {
      const res = await t.request(`/api/expenses${query}`, { headers })
      expect(res.status).toBe(422)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      )
    }
  })

  it('hides tombstoned rows from the list', async () => {
    const { headers } = await registerUser(t)
    const keepA = await createExpense(headers, { occurredAt: fixedNow.toISOString() })
    const gone = await createExpense(headers, {
      occurredAt: new Date(fixedNow.getTime() + 1000).toISOString(),
    })
    const keepB = await createExpense(headers, {
      occurredAt: new Date(fixedNow.getTime() + 2000).toISOString(),
    })

    const del = await t.request(`/api/expenses/${gone.id}`, {
      method: 'DELETE',
      headers,
    })
    expect(del.status).toBe(204)

    const listed = await listPage(headers, '?limit=10')
    expect(listed.items.map((e) => e.id)).toEqual([keepB.id, keepA.id])
  })
})

describe('GET /api/expenses/:id', () => {
  it('returns an owned expense and 404s a foreign or unknown one', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)
    const created = await createExpense(owner.headers, { note: 'mine' })

    const own = await t.request(`/api/expenses/${created.id}`, { headers: owner.headers })
    expect(own.status).toBe(200)
    expect(((await own.json()) as { note: string | null }).note).toBe('mine')

    const foreign = await t.request(`/api/expenses/${created.id}`, {
      headers: stranger.headers,
    })
    expect(foreign.status).toBe(404)

    const unknown = await t.request(`/api/expenses/${crypto.randomUUID()}`, {
      headers: owner.headers,
    })
    expect(unknown.status).toBe(404)

    const malformed = await t.request('/api/expenses/not-a-uuid', { headers: owner.headers })
    expect(malformed.status).toBe(422)
  })

  it('404s a tombstoned expense', async () => {
    const { headers } = await registerUser(t)
    const created = await createExpense(headers)
    await t.request(`/api/expenses/${created.id}`, { method: 'DELETE', headers })

    const res = await t.request(`/api/expenses/${created.id}`, { headers })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/expenses/:id', () => {
  it('updates fields and bumps updatedAt', async () => {
    const { headers } = await registerUser(t)
    const created = await createExpense(headers, { amountMinor: 100, note: 'before' })
    const before = await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })
    await new Promise((resolve) => setTimeout(resolve, 10))

    const res = await json(
      t,
      `/api/expenses/${created.id}`,
      headers,
      'PATCH',
      JSON.stringify({ amountMinor: 999, note: 'after' }),
    )
    expect(res.status).toBe(200)
    const updated = (await res.json()) as { amountMinor: number; note: string; updatedAt: string }
    expect(updated.amountMinor).toBe(999)
    expect(updated.note).toBe('after')

    const row = await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime())
  })

  it('clears and reassigns categoryId via null', async () => {
    const { headers } = await registerUser(t)
    const category = await firstCategory(headers)
    const created = await createExpense(headers, { categoryId: category.id })
    expect(created.categoryId).toBe(category.id)

    const cleared = await json(
      t,
      `/api/expenses/${created.id}`,
      headers,
      'PATCH',
      JSON.stringify({ categoryId: null }),
    )
    expect(cleared.status).toBe(200)
    expect(((await cleared.json()) as { categoryId: string | null }).categoryId).toBeNull()
  })

  it('404s foreign ids, tombstoned rows, and foreign categories', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)
    const created = await createExpense(owner.headers)
    const tombstoned = await createExpense(owner.headers)
    await t.request(`/api/expenses/${tombstoned.id}`, { method: 'DELETE', headers: owner.headers })
    const foreignCategory = await firstCategory(stranger.headers)

    const foreign = await json(
      t,
      `/api/expenses/${created.id}`,
      stranger.headers,
      'PATCH',
      JSON.stringify({ amountMinor: 1 }),
    )
    expect(foreign.status).toBe(404)

    const dead = await json(
      t,
      `/api/expenses/${tombstoned.id}`,
      owner.headers,
      'PATCH',
      JSON.stringify({ amountMinor: 1 }),
    )
    expect(dead.status).toBe(404)

    const badCategory = await json(
      t,
      `/api/expenses/${created.id}`,
      owner.headers,
      'PATCH',
      JSON.stringify({ categoryId: foreignCategory.id }),
    )
    expect(badCategory.status).toBe(404)
    expect(await t.db.expense.count({ where: { categoryId: foreignCategory.id } })).toBe(0)
  })
})

describe('DELETE /api/expenses/:id', () => {
  it('tombstones instead of deleting and hides the row', async () => {
    const { user, headers } = await registerUser(t)
    const created = await createExpense(headers)

    const res = await t.request(`/api/expenses/${created.id}`, {
      method: 'DELETE',
      headers,
    })
    expect(res.status).toBe(204)

    // Row survives with deletedAt set — the sync ticket's tombstone.
    const row = await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.userId).toBe(user.id)
    expect(row.deletedAt).not.toBeNull()

    const hidden = await t.request(`/api/expenses/${created.id}`, { headers })
    expect(hidden.status).toBe(404)
  })

  it('404s on foreign, tombstoned, and unknown ids without touching data', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)
    const created = await createExpense(owner.headers)

    const foreign = await t.request(`/api/expenses/${created.id}`, {
      method: 'DELETE',
      headers: stranger.headers,
    })
    expect(foreign.status).toBe(404)
    expect(await t.db.expense.findUnique({ where: { id: created.id } })).not.toBeNull()

    await t.request(`/api/expenses/${created.id}`, { method: 'DELETE', headers: owner.headers })
    const twice = await t.request(`/api/expenses/${created.id}`, {
      method: 'DELETE',
      headers: owner.headers,
    })
    expect(twice.status).toBe(404)

    const unknown = await t.request(`/api/expenses/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: owner.headers,
    })
    expect(unknown.status).toBe(404)
  })
})
