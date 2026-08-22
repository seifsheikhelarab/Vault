import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimits } from '../../config/rate-limit'
import { registerUser } from '../../test/fixtures'
import { buildApp, truncateAll } from '../../test/helpers'

// Chat parse tests (ticket #12). The parser is the project-wide mock seam,
// injected here via binding overrides; auth, validation, category resolution
// and error envelopes all run for real against Postgres.

const t = buildApp()

beforeEach(async () => {
  resetRateLimits()
  await truncateAll(t.db)
})

afterEach(async () => {
  await t.db.$disconnect()
})

/** JSON POST /api/chat/parse against a harness (bindings differ per stub). */
function parse(
  harness: ReturnType<typeof buildApp>,
  headers: Headers,
  body: string,
): Promise<Response> {
  const h = new Headers(headers)
  h.set('content-type', 'application/json')
  return harness.request('/api/chat/parse', { method: 'POST', headers: h, body })
}

type Draft = {
  amountMinor: number | null
  currency: string
  categoryGuess: string | null
  categoryId: string | null
  occurredAtGuess: string | null
  note: string | null
}

const taxiDraft = (overrides: Partial<Draft> = {}): Draft => ({
  amountMinor: 12000,
  currency: 'EGP',
  categoryGuess: 'Transport',
  categoryId: null, // never set by the model; resolved server-side
  occurredAtGuess: '2026-01-14',
  note: 'taxi to airport',
  ...overrides,
})

describe('POST /api/chat/parse', () => {
  it('returns a bare draft with the category guess resolved case-insensitively', async () => {
    const { user, headers } = await registerUser(t)
    // Signup seeds the defaults; "transport" must resolve to the seeded row.
    const seeded = (await (
      await t.request('/api/categories', { headers })
    ).json()) as { id: string; name: string }[]
    const transport = seeded.find((c) => c.name === 'Transport')!

    const chat = buildApp({ parseExpense: async () => taxiDraft({ categoryGuess: 'transport' }) })
    const res = await parse(chat, headers, JSON.stringify({ message: 'taxi 120 to airport yesterday' }))

    expect(res.status).toBe(200)
    const draft = (await res.json()) as Draft
    expect(draft).toEqual({
      amountMinor: 12000,
      currency: 'EGP',
      categoryGuess: 'transport',
      categoryId: transport.id,
      occurredAtGuess: '2026-01-14',
      note: 'taxi to airport',
    })

    // Spec story 23: parse NEVER saves — confirmation goes through expense create.
    expect(await t.db.expense.count({ where: { userId: user.id } })).toBe(0)
  })

  it('returns categoryId null for an unknown category guess', async () => {
    const { headers } = await registerUser(t)

    const chat = buildApp({
      parseExpense: async () => taxiDraft({ categoryGuess: 'Spaceship fuel' }),
    })
    const res = await parse(chat, headers, JSON.stringify({ message: 'fuel 500' }))

    expect(res.status).toBe(200)
    const draft = (await res.json()) as Draft
    expect(draft.categoryId).toBeNull()
    expect(draft.categoryGuess).toBe('Spaceship fuel')
  })

  it('maps malformed model output to the 502 envelope', async () => {
    const { headers } = await registerUser(t)

    for (const parseExpense of [
      async () => ({ amountMinor: 'lots', currency: 'EGP' }), // wrong shape
      async (): Promise<never> => {
        throw new Error('Gemini exploded') // parser/network failure
      },
    ]) {
      const chat = buildApp({ parseExpense })
      const res = await parse(chat, headers, JSON.stringify({ message: 'coffee 50' }))
      expect(res.status).toBe(502)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UPSTREAM_ERROR')
    }
  })

  it('returns the 502 envelope when GEMINI_API_KEY is missing at runtime', async () => {
    const { headers } = await registerUser(t)

    const chat = buildApp({ GEMINI_API_KEY: '' })
    const res = await parse(chat, headers, JSON.stringify({ message: 'coffee 50' }))
    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UPSTREAM_ERROR')
  })

  it('threads the requesting user timeZone into the parser', async () => {
    const { user, headers } = await registerUser(t)
    await t.db.user.update({ where: { id: user.id }, data: { timeZone: 'Europe/Paris' } })

    let seenTimeZone: string | undefined
    const chat = buildApp({
      parseExpense: async (_message, _now, timeZone) => {
        seenTimeZone = timeZone
        return taxiDraft()
      },
    })
    const res = await parse(chat, headers, JSON.stringify({ message: 'taxi 120 yesterday' }))

    expect(res.status).toBe(200)
    expect(seenTimeZone).toBe('Europe/Paris')
  })

  it('requires a session', async () => {
    const res = await parse(t, new Headers(), JSON.stringify({ message: 'coffee 50' }))
    expect(res.status).toBe(401)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED')
  })

  it('rejects a missing or blank message with the 422 envelope', async () => {
    const { headers } = await registerUser(t)
    for (const body of ['{}', '{"message":"   "}']) {
      const res = await parse(t, headers, body)
      expect(res.status).toBe(422)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      )
    }
  })
})
