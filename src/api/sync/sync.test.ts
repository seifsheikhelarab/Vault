import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimits } from '../../config/rate-limit'
import { fixedNow } from '../../test/helpers'
import { buildApp, truncateAll } from '../../test/helpers'
import { registerUser } from '../../test/fixtures'

// Sync resource tests (ticket #13): LWW batch push, incremental pull with
// tombstones, cursor stability — through app.request() against real Postgres.

const t = buildApp()

beforeEach(async () => {
  resetRateLimits()
  await truncateAll(t.db)
})

afterEach(async () => {
  await t.db.$disconnect()
})

function json(
  path: string,
  headers: Headers,
  method: string,
  body?: string,
): Promise<Response> {
  const h = new Headers(headers)
  h.set('content-type', 'application/json')
  return t.request(path, { method, headers: h, body })
}

type ExpenseItem = {
  id: string
  updatedAt: string
  amountMinor: number
  occurredAt: string
  categoryId?: string | null
  note?: string | null
  deletedAt?: string | null
}

type CategoryItem = {
  id: string
  updatedAt: string
  name: string
  deletedAt?: string | null
}

async function push(
  headers: Headers,
  body: { expenses?: ExpenseItem[]; categories?: CategoryItem[] },
): Promise<{ results: { id: string; outcome: string }[] }> {
  const res = await json('/api/sync/push', headers, 'POST', JSON.stringify(body))
  expect(res.status).toBe(200)
  return (await res.json()) as { results: { id: string; outcome: string }[] }
}

async function pull(
  headers: Headers,
  query = '',
): Promise<{
  expenses: Record<string, unknown>[]
  categories: { id: string; name: string }[]
  nextCursor: string | null
}> {
  const res = await t.request(`/api/sync/pull${query}`, { headers })
  expect(res.status).toBe(200)
  return (await res.json()) as Awaited<ReturnType<typeof pull>>
}

function outcomeOf(results: { id: string; outcome: string }[], id: string): string {
  const hit = results.find((r) => r.id === id)
  if (!hit) throw new Error(`no push result for ${id}`)
  return hit.outcome
}

/** Full-payload expense item at a deterministic instant. */
function expenseItem(
  overrides: Partial<ExpenseItem> & { updatedAt: string },
): ExpenseItem {
  return {
    id: crypto.randomUUID(),
    amountMinor: 2500,
    occurredAt: overrides.updatedAt,
    ...overrides,
  }
}

describe('sync auth', () => {
  it('requires a session on push and pull', async () => {
    const noCookie = json(
      '/api/sync/push',
      new Headers(),
      'POST',
      JSON.stringify({ expenses: [] }),
    )
    expect((await noCookie).status).toBe(401)
    expect((await t.request('/api/sync/pull', { headers: new Headers() })).status).toBe(401)
  })
})

describe('POST /api/sync/push', () => {
  it('accepts an unknown id as a create', async () => {
    const { headers } = await registerUser(t)
    const item = expenseItem({
      updatedAt: fixedNow.toISOString(),
      amountMinor: 4321,
      note: 'from device',
    })

    const results = (await push(headers, { expenses: [item] })).results
    expect(outcomeOf(results, item.id)).toBe('accepted')

    const row = await t.db.expense.findUniqueOrThrow({ where: { id: item.id } })
    expect(row.amountMinor).toBe(BigInt(4321))
    // Client updatedAt is authoritative: stored verbatim, not clock-bumped.
    expect(row.updatedAt.getTime()).toBe(fixedNow.getTime())
  })

  it('resolves server-newer edits as conflict-lost and keeps the server payload', async () => {
    const { headers } = await registerUser(t)
    const at = fixedNow.toISOString()
    const created = expenseItem({ updatedAt: at, amountMinor: 100 })
    expect(outcomeOf((await push(headers, { expenses: [created] })).results, created.id)).toBe(
      'accepted',
    )

    // Stale edit from another device: older updatedAt loses.
    const stale = expenseItem({
      id: created.id,
      updatedAt: new Date(fixedNow.getTime() - 5000).toISOString(),
      amountMinor: 999,
    })
    expect(outcomeOf((await push(headers, { expenses: [stale] })).results, stale.id)).toBe(
      'conflict-lost',
    )

    const row = await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.amountMinor).toBe(BigInt(100))
  })

  it('applies client-newer edits including the client updatedAt', async () => {
    const { headers } = await registerUser(t)
    const created = expenseItem({ updatedAt: fixedNow.toISOString(), note: 'v1' })
    await push(headers, { expenses: [created] })

    const newerAt = new Date(fixedNow.getTime() + 5000).toISOString()
    const edit = expenseItem({
      id: created.id,
      updatedAt: newerAt,
      amountMinor: 777,
      note: 'v2',
    })
    expect(outcomeOf((await push(headers, { expenses: [edit] })).results, edit.id)).toBe(
      'accepted',
    )

    const row = await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.amountMinor).toBe(BigInt(777))
    expect(row.note).toBe('v2')
    expect(row.updatedAt.toISOString()).toBe(newerAt)
  })

  it('breaks equal timestamps in the server’s favor (documented tie-break)', async () => {
    const { headers } = await registerUser(t)
    const at = fixedNow.toISOString()
    const created = expenseItem({ updatedAt: at, amountMinor: 100 })
    await push(headers, { expenses: [created] })

    const tie = expenseItem({ id: created.id, updatedAt: at, amountMinor: 200 })
    expect(outcomeOf((await push(headers, { expenses: [tie] })).results, tie.id)).toBe(
      'conflict-lost',
    )
    expect(
      (await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })).amountMinor,
    ).toBe(BigInt(100))
  })

  it('reports foreign ids as conflict-lost without touching them', async () => {
    const owner = await registerUser(t)
    const stranger = await registerUser(t)

    const theirs = expenseItem({ updatedAt: fixedNow.toISOString(), amountMinor: 100 })
    await push(stranger.headers, { expenses: [theirs] })

    const hijack = expenseItem({
      id: theirs.id,
      updatedAt: new Date(fixedNow.getTime() + 10_000).toISOString(),
      amountMinor: 666,
    })
    expect(outcomeOf((await push(owner.headers, { expenses: [hijack] })).results, hijack.id)).toBe(
      'conflict-lost',
    )
    expect(
      (await t.db.expense.findUniqueOrThrow({ where: { id: theirs.id } })).amountMinor,
    ).toBe(BigInt(100))
  })

  it('applies pushed tombstones and replays them as conflict-lost', async () => {
    const { headers } = await registerUser(t)
    const created = expenseItem({ updatedAt: fixedNow.toISOString() })
    await push(headers, { expenses: [created] })

    const tombstone = expenseItem({
      id: created.id,
      updatedAt: new Date(fixedNow.getTime() + 1000).toISOString(),
      deletedAt: new Date(fixedNow.getTime() + 1000).toISOString(),
    })
    expect(outcomeOf((await push(headers, { expenses: [tombstone] })).results, tombstone.id)).toBe(
      'accepted',
    )
    expect(
      (await t.db.expense.findUniqueOrThrow({ where: { id: created.id } })).deletedAt,
    ).not.toBeNull()

    // Replay of the same tombstone: equal timestamp, server wins, stays deleted.
    expect(outcomeOf((await push(headers, { expenses: [tombstone] })).results, tombstone.id)).toBe(
      'conflict-lost',
    )
    expect(await t.db.expense.count()).toBe(1)
  })

  it('resolves category renames with the same LWW rule', async () => {
    const { headers } = await registerUser(t)
    const at = fixedNow.toISOString()
    const category = {
      id: crypto.randomUUID(),
      updatedAt: at,
      name: 'Offline Cat',
    }
    await push(headers, { categories: [category] })

    const staleRename = {
      id: category.id,
      updatedAt: new Date(fixedNow.getTime() - 1000).toISOString(),
      name: 'Loser',
    }
    expect(
      outcomeOf((await push(headers, { categories: [staleRename] })).results, staleRename.id),
    ).toBe('conflict-lost')
    expect(
      (await t.db.category.findUniqueOrThrow({ where: { id: category.id } })).name,
    ).toBe('Offline Cat')

    const freshRename = {
      id: category.id,
      updatedAt: new Date(fixedNow.getTime() + 1000).toISOString(),
      name: 'Winner',
    }
    expect(
      outcomeOf((await push(headers, { categories: [freshRename] })).results, freshRename.id),
    ).toBe('accepted')
    expect(
      (await t.db.category.findUniqueOrThrow({ where: { id: category.id } })).name,
    ).toBe('Winner')
  })

  it('deletes categories on tombstone push; replay is an idempotent no-op', async () => {
    const { headers } = await registerUser(t)
    const category = {
      id: crypto.randomUUID(),
      updatedAt: fixedNow.toISOString(),
      name: 'Doomed',
    }
    await push(headers, { categories: [category] })

    const tombstone = {
      id: category.id,
      updatedAt: new Date(fixedNow.getTime() + 1000).toISOString(),
      name: 'Doomed',
      deletedAt: new Date(fixedNow.getTime() + 1000).toISOString(),
    }
    expect(
      outcomeOf((await push(headers, { categories: [tombstone] })).results, tombstone.id),
    ).toBe('accepted')
    expect(await t.db.category.findUnique({ where: { id: category.id } })).toBeNull()

    // Replay: row already gone → accepted no-op, never resurrected.
    expect(
      outcomeOf((await push(headers, { categories: [tombstone] })).results, tombstone.id),
    ).toBe('accepted')
    expect(await t.db.category.findUnique({ where: { id: category.id } })).toBeNull()
  })

  it('rolls back the whole batch on an unknown categoryId reference', async () => {
    const { headers } = await registerUser(t)
    const good = expenseItem({ updatedAt: fixedNow.toISOString() })
    const badRef = expenseItem({
      updatedAt: fixedNow.toISOString(),
      categoryId: crypto.randomUUID(),
    })

    const res = await json(
      '/api/sync/push',
      headers,
      'POST',
      JSON.stringify({ expenses: [good, badRef] }),
    )
    expect(res.status).toBe(422)
    // Atomicity: the valid sibling must not survive the failed batch.
    expect(await t.db.expense.count()).toBe(0)
  })

  it('validates item shape with the 422 envelope', async () => {
    const { headers } = await registerUser(t)
    for (const body of [
      { expenses: [{ id: 'not-a-uuid', updatedAt: fixedNow.toISOString(), amountMinor: 1, occurredAt: fixedNow.toISOString() }] },
      { expenses: [{ id: crypto.randomUUID(), amountMinor: 1, occurredAt: fixedNow.toISOString() }] }, // no updatedAt
      { expenses: [{ id: crypto.randomUUID(), updatedAt: 'yesterday', amountMinor: 1, occurredAt: fixedNow.toISOString() }] },
    ]) {
      const res = await json('/api/sync/push', headers, 'POST', JSON.stringify(body))
      expect(res.status).toBe(422)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      )
    }
  })

  it('is idempotent on verbatim re-push: no dupes, consistent outcomes', async () => {
    const { headers } = await registerUser(t)
    const category = { id: crypto.randomUUID(), updatedAt: fixedNow.toISOString(), name: 'Synced' }
    const a = expenseItem({
      updatedAt: fixedNow.toISOString(),
      categoryId: category.id,
      note: 'batch one',
    })
    const b = expenseItem({ updatedAt: new Date(fixedNow.getTime() + 2000).toISOString() })
    const batch = { categories: [category], expenses: [a, b] }

    const first = (await push(headers, batch)).results
    expect(first.map((r) => r.outcome)).toEqual(['accepted', 'accepted', 'accepted'])

    const replay = (await push(headers, batch)).results
    // Equal timestamps → server wins every comparison → nothing reapplied.
    expect(replay.map((r) => r.outcome)).toEqual([
      'conflict-lost',
      'conflict-lost',
      'conflict-lost',
    ])
    expect(await t.db.expense.count()).toBe(2)
    expect(await t.db.category.count({ where: { name: 'Synced' } })).toBe(1)
  })
})

describe('GET /api/sync/pull', () => {
  it('propagates deletions: tombstoned rows come back with deletedAt set', async () => {
    const { headers } = await registerUser(t)
    await json('/api/expenses', headers, 'POST', JSON.stringify({ id: crypto.randomUUID(), amountMinor: 100 }))
    const goneRes = await json('/api/expenses', headers, 'POST', JSON.stringify({ id: crypto.randomUUID(), amountMinor: 200 }))
    const goneId = ((await goneRes.json()) as { id: string }).id

    const del = await t.request(`/api/expenses/${goneId}`, { method: 'DELETE', headers })
    expect(del.status).toBe(204)

    const page = await pull(headers)
    const tombstones = page.expenses.filter((e) => e.id === goneId)
    expect(tombstones).toHaveLength(1)
    expect((tombstones[0].deletedAt as string | null) ?? null).not.toBeNull()
  })

  it('walks one watermark across both tables with stable pagination', async () => {
    const { headers } = await registerUser(t)
    const category = { id: crypto.randomUUID(), updatedAt: fixedNow.toISOString(), name: 'C1' }
    // Six expenses at spaced instants plus one category interleaved in time.
    // (Signup also seeds 8 default categories at real-clock timestamps; the
    // count assertions below only track the ids this test controls.)
    const items: ExpenseItem[] = []
    for (let i = 1; i <= 6; i++) {
      items.push(
        expenseItem({
          updatedAt: new Date(fixedNow.getTime() + i * 1000).toISOString(),
          note: `e${i}`,
        }),
      )
    }
    await push(headers, {
      categories: [
        category,
        { id: crypto.randomUUID(), updatedAt: new Date(fixedNow.getTime() + 3500).toISOString(), name: 'C2' },
      ],
      expenses: items,
    })

    const expectedIds = [category.id, ...items.map((i) => i.id)]
    const seenIds: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const page = await pull(headers, cursor ? `?limit=3&cursor=${cursor}` : '?limit=3')
      expect(page.expenses.length + page.categories.length).toBeLessThanOrEqual(3)
      seenIds.push(...page.expenses.map((e) => e.id as string), ...page.categories.map((c) => c.id))
      cursor = page.nextCursor
      pages++
    } while (cursor !== null && pages < 20)

    // Every controlled row appears exactly once across the whole walk.
    const counts = new Map<string, number>()
    for (const id of seenIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const id of expectedIds) expect(counts.get(id)).toBe(1)
    expect(pages).toBeGreaterThan(1)
  })

  it('keeps the walk stable when a newer row lands mid-pagination', async () => {
    const { headers } = await registerUser(t)
    const items: ExpenseItem[] = []
    for (let i = 1; i <= 6; i++) {
      items.push(
        expenseItem({
          updatedAt: new Date(fixedNow.getTime() + i * 1000).toISOString(),
        }),
      )
    }
    await push(headers, { expenses: items })

    const firstPage = await pull(headers, '?limit=2')
    const seenFirst = firstPage.expenses.map((e) => e.id as string)
    expect(seenFirst).toHaveLength(2)

    // Concurrent write from another device, strictly after the watermark.
    const latecomer = expenseItem({
      updatedAt: new Date(fixedNow.getTime() + 600_000).toISOString(),
    })
    await push(headers, { expenses: [latecomer] })

    const seen: string[] = [...seenFirst]
    let cursor: string | null = firstPage.nextCursor
    let pages = 0
    while (cursor !== null && pages < 20) {
      const page = await pull(headers, `?limit=2&cursor=${cursor}`)
      seen.push(...page.expenses.map((e) => e.id as string))
      cursor = page.nextCursor
      pages++
    }

    // Pre-cursor rows appear exactly once (no skips, no dupes); latecomer too.
    for (const item of items) {
      expect(seen.filter((id) => id === item.id)).toHaveLength(1)
    }
    expect(seen.filter((id) => id === latecomer.id)).toHaveLength(1)
    expect(seen.length).toBe(items.length + 1)
  })

  it('returns an empty expense page with a null cursor when nothing changed', async () => {
    const { headers } = await registerUser(t)
    const page = await pull(headers)
    // Fresh user: no expenses yet (seeded default categories may appear).
    expect(page.expenses).toEqual([])
    expect(page.nextCursor).toBeNull()
  })

  it('rejects malformed cursors and out-of-range limits with 422', async () => {
    const { headers } = await registerUser(t)
    for (const query of ['?cursor=garbage', '?limit=0', '?limit=101']) {
      const res = await t.request(`/api/sync/pull${query}`, { headers })
      expect(res.status).toBe(422)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      )
    }
  })
})
