import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimits } from '../../config/rate-limit'
import type { PrismaClient } from '../../generated/prisma/client'
import { registerUser } from '../../test/fixtures'
import { buildApp, fixedNow, truncateAll } from '../../test/helpers'
import { createDefinition, materializeDue } from './service'

// Recurring resource tests (ticket #9): definition CRUD over app.request(),
// materialization through the pure `materializeDue(db, now)` seam with pinned
// clocks against real Postgres.

const t = buildApp()

beforeEach(async () => {
  resetRateLimits()
  await truncateAll(t.db)
})

afterEach(async () => {
  await t.db.$disconnect()
})

type DefinitionBody = {
  name?: string
  amountMinor?: number
  categoryId?: string | null
  frequency?: 'daily' | 'weekly' | 'monthly'
  interval?: number
  anchorDate?: string
  paused?: boolean
}

async function request(
  path: string,
  headers: Headers,
  method: string,
  body?: string,
): Promise<Response> {
  const h = new Headers(headers)
  h.set('content-type', 'application/json')
  return t.request(`/api/recurring${path}`, { method, headers: h, body })
}

async function postDefinition(
  headers: Headers,
  overrides: DefinitionBody = {},
): Promise<Record<string, unknown> & { id: string }> {
  const body = {
    name: 'Netflix',
    amountMinor: 150000,
    frequency: 'monthly',
    anchorDate: '2026-01-31',
    ...overrides,
  }
  const res = await request('', headers, 'POST', JSON.stringify(body))
  expect(res.status).toBe(201)
  return (await res.json()) as Record<string, unknown> & { id: string }
}

/** All occurrence dates across every expense, oldest first, as YYYY-MM-DD. */
async function occurrenceDates(db: PrismaClient): Promise<string[]> {
  const rows = await db.expense.findMany({
    orderBy: [{ occurrenceDate: 'asc' }, { id: 'asc' }],
    select: { occurrenceDate: true },
  })
  return rows.flatMap((r) =>
    r.occurrenceDate ? [r.occurrenceDate.toISOString().slice(0, 10)] : [],
  )
}

describe('POST /api/recurring', () => {
  it('creates a definition with nextRunAt anchored to anchorDate', async () => {
    const { user, headers } = await registerUser(t)

    const created = await postDefinition(headers, {
      name: 'Gym',
      amountMinor: 35000,
      frequency: 'weekly',
      interval: 2,
      anchorDate: '2026-01-05',
    })

    expect(created.name).toBe('Gym')
    expect(created.amountMinor).toBe(35000)
    expect(created.frequency).toBe('weekly')
    expect(created.interval).toBe(2)
    expect(created.paused).toBe(false)
    expect(created.currency).toBe('EGP')
    expect(created.anchorDate).toBe('2026-01-05T00:00:00.000Z')
    expect(created.nextRunAt).toBe('2026-01-05T00:00:00.000Z')
    expect(created.lastMaterializedAt).toBeNull()

    const row = await t.db.recurringDefinition.findUniqueOrThrow({ where: { id: created.id } })
    expect(row.userId).toBe(user.id)
    expect(row.amountMinor).toBe(BigInt(35000))
  })

  it('404s a foreign categoryId', async () => {
    const { headers } = await registerUser(t)
    const other = await registerUser(t)
    const categoryRes = await t.request('/api/categories', { headers: other.headers })
    const foreignCategory = ((await categoryRes.json()) as { id: string }[])[0]

    const res = await request(
      '',
      headers,
      'POST',
      JSON.stringify({
        name: 'X',
        amountMinor: 100,
        frequency: 'daily',
        anchorDate: '2026-01-01',
        categoryId: foreignCategory.id,
      }),
    )
    expect(res.status).toBe(404)
  })

  it('422s an invalid payload', async () => {
    const { headers } = await registerUser(t)
    const res = await request(
      '',
      headers,
      'POST',
      JSON.stringify({ name: 'X', amountMinor: 100, frequency: 'hourly', anchorDate: '2026-01-01' }),
    )
    expect(res.status).toBe(422)
  })
})

describe('recurring CRUD', () => {
  it('lists only the owner definitions', async () => {
    const mine = await registerUser(t)
    const theirs = await registerUser(t)
    const a = await postDefinition(mine.headers)
    await postDefinition(theirs.headers)

    const res = await request('', mine.headers, 'GET')
    expect(res.status).toBe(200)
    const list = (await res.json()) as { id: string }[]
    expect(list.map((d) => d.id)).toEqual([a.id])

    const single = await request(`/${a.id}`, theirs.headers, 'GET')
    expect(single.status).toBe(404)
  })

  it('PATCH pauses and resumes via the paused flag and edits fields', async () => {
    const { headers } = await registerUser(t)
    const def = await postDefinition(headers)

    const paused = await request(`/${def.id}`, headers, 'PATCH', JSON.stringify({ paused: true }))
    expect(paused.status).toBe(200)
    expect(((await paused.json()) as { paused: boolean }).paused).toBe(true)

    const edited = await request(
      `/${def.id}`,
      headers,
      'PATCH',
      JSON.stringify({ amountMinor: 200000, paused: false }),
    )
    expect(edited.status).toBe(200)
    const row = (await edited.json()) as { paused: boolean; amountMinor: number }
    expect(row.paused).toBe(false)
    expect(row.amountMinor).toBe(200000)
  })

  it('PATCH moves nextRunAt when anchorDate changes', async () => {
    const { headers } = await registerUser(t)
    const def = await postDefinition(headers)

    await request(`/${def.id}`, headers, 'PATCH', JSON.stringify({ anchorDate: '2026-02-10' }))
    const row = await t.db.recurringDefinition.findUniqueOrThrow({ where: { id: def.id } })
    expect(row.anchorDate.toISOString()).toBe('2026-02-10T00:00:00.000Z')
    expect(row.nextRunAt.toISOString()).toBe('2026-02-10T00:00:00.000Z')
  })

  it('DELETE removes the definition; repeats and foreign ids 404', async () => {
    const { user, headers } = await registerUser(t)
    const def = await postDefinition(headers)

    const deleted = await request(`/${def.id}`, headers, 'DELETE')
    expect(deleted.status).toBe(204)
    expect(await t.db.recurringDefinition.count({ where: { userId: user.id } })).toBe(0)

    const repeat = await request(`/${def.id}`, headers, 'DELETE')
    expect(repeat.status).toBe(404)
  })
})

describe('materializeDue', () => {
  it('generates daily occurrences up to now and advances the cursor', async () => {
    const { user } = await registerUser(t)
    const db = t.db
    const def = await createDefinition(db, user.id, {
      name: 'Coffee',
      amountMinor: 2500,
      frequency: 'daily',
      anchorDate: '2026-01-01',
    })

    const result = await materializeDue(db, fixedNow)

    expect(result.created).toBe(15) // Jan 1..15 inclusive
    expect(await occurrenceDates(db)).toEqual(
      Array.from({ length: 15 }, (_, i) =>
        `2026-01-${String(i + 1).padStart(2, '0')}`,
      ),
    )
    const row = await db.recurringDefinition.findUniqueOrThrow({ where: { id: def.id } })
    expect(row.nextRunAt.toISOString()).toBe('2026-01-16T00:00:00.000Z')
    expect(row.lastMaterializedAt).toEqual(fixedNow)

    const first = await db.expense.findFirstOrThrow({
      where: { recurringDefinitionId: def.id },
      orderBy: { occurrenceDate: 'asc' },
    })
    expect(first.userId).toBe(user.id)
    expect(first.amountMinor).toBe(BigInt(2500))
    expect(first.currency).toBe('EGP')
    expect(first.occurredAt.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(first.deletedAt).toBeNull()
  })

  it('generates weekly occurrences on the anchor weekday', async () => {
    const { user } = await registerUser(t)
    // Jan 1 2026 is a Thursday: Jan 1, 8, 15 are due by fixedNow.
    await createDefinition(t.db, user.id, {
      name: 'Cleaning',
      amountMinor: 12000,
      frequency: 'weekly',
      anchorDate: '2026-01-01',
    })

    const result = await materializeDue(t.db, fixedNow)

    expect(result.created).toBe(3)
    expect(await occurrenceDates(t.db)).toEqual(['2026-01-01', '2026-01-08', '2026-01-15'])
  })

  it('honors interval > 1 for weekly cadence', async () => {
    const { user } = await registerUser(t)
    await createDefinition(t.db, user.id, {
      name: 'Biweekly',
      amountMinor: 5000,
      frequency: 'weekly',
      interval: 2,
      anchorDate: '2026-01-01',
    })

    const result = await materializeDue(t.db, new Date('2026-01-29T12:00:00.000Z'))

    expect(result.created).toBe(3) // Jan 1, 15, 29
    expect(await occurrenceDates(t.db)).toEqual(['2026-01-01', '2026-01-15', '2026-01-29'])
  })

  it('keeps monthly month-end anchors sane across short months', async () => {
    const { user } = await registerUser(t)
    const def = await createDefinition(t.db, user.id, {
      name: 'Rent',
      amountMinor: 600000,
      frequency: 'monthly',
      anchorDate: '2026-01-31',
    })

    const result = await materializeDue(t.db, new Date('2026-03-31T12:00:00.000Z'))

    expect(result.created).toBe(3) // Jan 31, Feb 28, Mar 31
    expect(await occurrenceDates(t.db)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
    const row = await t.db.recurringDefinition.findUniqueOrThrow({ where: { id: def.id } })
    // Anchor day preserved: April clamps to its last day.
    expect(row.nextRunAt.toISOString()).toBe('2026-04-30T00:00:00.000Z')
  })

  it('catches up every missed occurrence after a multi-day gap exactly once', async () => {
    const { user } = await registerUser(t)
    const db = t.db
    await createDefinition(db, user.id, {
      name: 'Sub',
      amountMinor: 900,
      frequency: 'daily',
      anchorDate: '2026-01-01',
    })

    await materializeDue(db, new Date('2026-01-03T12:00:00.000Z'))
    expect(await occurrenceDates(db)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])

    // Simulated downtime: next run is a week later and backfills the gap.
    const result = await materializeDue(db, new Date('2026-01-10T12:00:00.000Z'))

    expect(result.created).toBe(7) // Jan 4..10
    expect(await occurrenceDates(db)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ])

    // Double-run at the same instant produces zero duplicates.
    const rerun = await materializeDue(db, new Date('2026-01-10T12:00:00.000Z'))
    expect(rerun.created).toBe(0)
    expect(await db.expense.count()).toBe(10)
  })

  it('skips paused definitions entirely', async () => {
    const { user, headers } = await registerUser(t)
    await createDefinition(t.db, user.id, {
      name: 'Active',
      amountMinor: 100,
      frequency: 'daily',
      anchorDate: '2026-01-01',
    })
    const pausedDef = await createDefinition(t.db, user.id, {
      name: 'Paused',
      amountMinor: 200,
      frequency: 'daily',
      anchorDate: '2026-01-01',
    })
    await request(`/${pausedDef.id}`, headers, 'PATCH', JSON.stringify({ paused: true }))

    const result = await materializeDue(t.db, fixedNow)

    expect(result.created).toBe(15)
    expect(await t.db.expense.count({ where: { recurringDefinitionId: pausedDef.id } })).toBe(0)
    const untouched = await t.db.recurringDefinition.findUniqueOrThrow({
      where: { id: pausedDef.id },
    })
    expect(untouched.nextRunAt.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(untouched.lastMaterializedAt).toBeNull()
  })

  it('scopes by userId when given and covers all users otherwise', async () => {
    const a = await registerUser(t)
    const b = await registerUser(t)
    await createDefinition(t.db, a.user.id, {
      name: 'A sub',
      amountMinor: 100,
      frequency: 'daily',
      anchorDate: '2026-01-01',
    })
    await createDefinition(t.db, b.user.id, {
      name: 'B sub',
      amountMinor: 100,
      frequency: 'daily',
      anchorDate: '2026-01-01',
    })

    await materializeDue(t.db, fixedNow, a.user.id)
    expect(await t.db.expense.count()).toBe(15)
    expect(await occurrenceDates(t.db)).toHaveLength(15)

    // Cron-style run without userId processes everyone.
    const result = await materializeDue(t.db, fixedNow)
    expect(result.created).toBe(15) // only B's remaining occurrences
    expect(await t.db.expense.count()).toBe(30)
  })

  it('does not resurrect a deleted instance; later occurrences still land', async () => {
    const { user } = await registerUser(t)
    const db = t.db
    const def = await createDefinition(db, user.id, {
      name: 'Daily',
      amountMinor: 300,
      frequency: 'daily',
      anchorDate: '2026-01-01',
    })

    await materializeDue(db, new Date('2026-01-03T12:00:00.000Z'))
    const jan2 = await db.expense.findFirstOrThrow({
      where: { recurringDefinitionId: def.id, occurrenceDate: new Date('2026-01-02T00:00:00.000Z') },
    })
    await db.expense.update({ where: { id: jan2.id }, data: { deletedAt: fixedNow } })

    await materializeDue(db, new Date('2026-01-05T12:00:00.000Z'))

    const rows = await db.expense.findMany({
      where: { recurringDefinitionId: def.id },
      orderBy: { occurrenceDate: 'asc' },
    })
    expect(
      rows.flatMap((r) => (r.occurrenceDate ? [r.occurrenceDate.toISOString().slice(0, 10)] : [])),
    ).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
    ])
    expect(rows.find((r) => r.id === jan2.id)?.deletedAt).toEqual(fixedNow)
  })
})
