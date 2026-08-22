import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimits } from '../../config/rate-limit'
import { fixedNow } from '../../test/helpers'
import { registerUser } from '../../test/fixtures'
import { buildApp, truncateAll } from '../../test/helpers'
import { DEFAULT_CATEGORY_NAMES } from './service'

// Categories resource tests (ticket #6): signup seeding + full CRUD through
// app.request() against real Postgres, per spec #1 stories 9–11.

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

async function createCategory(headers: Headers, name: string): Promise<{ id: string; name: string }> {
  const res = await json(t, '/api/categories', headers, 'POST', JSON.stringify({ name }))
  expect(res.status).toBe(201)
  return (await res.json()) as { id: string; name: string }
}

describe('signup seeding', () => {
  it('seeds the eight default categories for each new user', async () => {
    const a = await registerUser(t)
    const b = await registerUser(t)

    for (const u of [a, b]) {
      const res = await t.request('/api/categories', { headers: u.headers })
      expect(res.status).toBe(200)
      const categories = (await res.json()) as { id: string; name: string }[]
      // Deterministic tie-break on name when seed rows share a timestamp.
      expect(categories.map((c) => c.name)).toEqual([...DEFAULT_CATEGORY_NAMES].sort())
      expect(categories[0].id).toBeTruthy()
      expect(categories).toHaveLength(DEFAULT_CATEGORY_NAMES.length)
    }
  })
})

describe('POST /api/categories', () => {
  it('creates a category', async () => {
    const { headers } = await registerUser(t)
    const created = await createCategory(headers, 'Coffee')
    expect(created.name).toBe('Coffee')

    const row = await t.db.category.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.name).toBe('Coffee')
  })

  it('rejects a duplicate name with 409', async () => {
    const { headers } = await registerUser(t)
    const res = await json(t, '/api/categories', headers, 'POST', JSON.stringify({ name: 'Bills' }))
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('CONFLICT')
  })

  it('rejects an empty or missing name with the 422 envelope', async () => {
    const { headers } = await registerUser(t)
    for (const body of ['{"name":"   "}', '{}']) {
      const res = await json(t, '/api/categories', headers, 'POST', body)
      expect(res.status).toBe(422)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      )
    }
  })

  it('requires a session', async () => {
    const res = await json(
      t,
      '/api/categories',
      new Headers(),
      'POST',
      JSON.stringify({ name: 'Nope' }),
    )
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/categories/:id', () => {
  it('returns an owned category and 404s a foreign one', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)
    const created = await createCategory(owner.headers, 'Coffee')

    const own = await t.request(`/api/categories/${created.id}`, { headers: owner.headers })
    expect(own.status).toBe(200)
    expect(((await own.json()) as { name: string }).name).toBe('Coffee')

    // Cross-user reads look like missing rows: 404, not 403.
    const foreign = await t.request(`/api/categories/${created.id}`, {
      headers: stranger.headers,
    })
    expect(foreign.status).toBe(404)
  })

  it('404s an unknown id and 422s a malformed one', async () => {
    const { headers } = await registerUser(t)
    const unknown = await t.request(`/api/categories/${crypto.randomUUID()}`, { headers })
    expect(unknown.status).toBe(404)

    const malformed = await t.request('/api/categories/not-a-uuid', { headers })
    expect(malformed.status).toBe(422)
  })
})

describe('PATCH /api/categories/:id', () => {
  it('renames an owned category', async () => {
    const { headers } = await registerUser(t)
    const created = await createCategory(headers, 'Coffee')

    const res = await json(
      t,
      `/api/categories/${created.id}`,
      headers,
      'PATCH',
      JSON.stringify({ name: 'Cafe' }),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { name: string }).name).toBe('Cafe')
  })

  it('rejects renaming onto an existing name and foreign ids', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)

    const seeded = (await (
      await t.request('/api/categories', { headers: owner.headers })
    ).json()) as { id: string; name: string }[]
    const groceries = seeded.find((c) => c.name === 'Groceries')!
    const transport = seeded.find((c) => c.name === 'Transport')!

    const dup = await json(
      t,
      `/api/categories/${groceries.id}`,
      owner.headers,
      'PATCH',
      JSON.stringify({ name: 'Transport' }),
    )
    expect(dup.status).toBe(409)

    const foreign = await json(
      t,
      `/api/categories/${transport.id}`,
      stranger.headers,
      'PATCH',
      JSON.stringify({ name: 'Hijack' }),
    )
    expect(foreign.status).toBe(404)
    const untouched = await t.db.category.findUniqueOrThrow({ where: { id: transport.id } })
    expect(untouched.name).toBe('Transport')
  })
})

describe('DELETE /api/categories/:id', () => {
  it('deletes an owned category and nulls expense references', async () => {
    const { user, headers } = await registerUser(t)
    const created = await createCategory(headers, 'Coffee')

    const expense = await t.db.expense.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        amountMinor: BigInt(2500),
        categoryId: created.id,
        occurredAt: fixedNow,
        note: 'latte',
      },
    })

    const res = await t.request(`/api/categories/${created.id}`, {
      method: 'DELETE',
      headers,
    })
    expect(res.status).toBe(204)

    expect(await t.db.category.findUnique({ where: { id: created.id } })).toBeNull()
    const surviving = await t.db.expense.findUniqueOrThrow({ where: { id: expense.id } })
    expect(surviving.categoryId).toBeNull()
  })

  it('404s on foreign and unknown ids without deleting anything', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)
    const created = await createCategory(owner.headers, 'Coffee')

    const foreign = await t.request(`/api/categories/${created.id}`, {
      method: 'DELETE',
      headers: stranger.headers,
    })
    expect(foreign.status).toBe(404)
    expect(await t.db.category.findUnique({ where: { id: created.id } })).not.toBeNull()

    const unknown = await t.request(`/api/categories/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: owner.headers,
    })
    expect(unknown.status).toBe(404)
  })
})
