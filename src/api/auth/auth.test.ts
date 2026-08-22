import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requireAuth } from '../../config/auth'
import { onError } from '../../config/errors'
import type { AppBindings } from '../../config/env'
import { resetRateLimits } from '../../config/rate-limit'
import { registerUser } from '../../test/fixtures'
import { buildApp, truncateAll } from '../../test/helpers'

// Auth resource tests (ticket #5): everything through app.request() against
// real Postgres — signup/login/logout/session plus guard + failure paths.

const t = buildApp()

beforeEach(async () => {
  resetRateLimits()
  await truncateAll(t.db)
})

afterEach(async () => {
  await t.db.$disconnect()
})

describe('POST /api/auth/sign-up/email', () => {
  it('creates a user and starts a session', async () => {
    const res = await t.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Ada',
        email: 'ada@test.local',
        password: 'correct-horse-battery',
      }),
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { user: { email: string; name: string } }
    expect(json.user.email).toBe('ada@test.local')
    expect(res.headers.get('set-cookie')).toContain('better-auth.session_token')

    const row = await t.db.user.findUniqueOrThrow({ where: { email: 'ada@test.local' } })
    expect(row.emailVerified).toBe(false)
    const account = await t.db.account.findFirstOrThrow({ where: { userId: row.id } })
    expect(account.providerId).toBe('credential')
  })

  it('rejects a duplicate email', async () => {
    const body = {
      name: 'Dup',
      email: 'dup@test.local',
      password: 'correct-horse-battery',
    }
    const first = await t.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(first.status).toBe(200)

    const second = await t.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(second.status).toBe(422)
  })

  it('rejects a too-short password', async () => {
    const res = await t.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Shorty', email: 'shorty@test.local', password: 'short' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/sign-in/email', () => {
  it('logs in with valid credentials and sets the session cookie', async () => {
    const { user, password } = await registerUser(t)
    const res = await t.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toContain('better-auth.session_token')
  })

  it('fails on a wrong password', async () => {
    const { user } = await registerUser(t)
    const res = await t.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'wrong-password-here' }),
    })
    expect(res.status).toBe(401)
  })

  it('fails on an unknown email', async () => {
    const res = await t.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody@test.local',
        password: 'correct-horse-battery',
      }),
    })
    expect(res.status).toBe(401)
  })
})

describe('session lifecycle', () => {
  it('get-session returns the user with a cookie and null without', async () => {
    const { user, headers } = await registerUser(t)

    const authed = await t.request('/api/auth/get-session', { headers })
    expect(authed.status).toBe(200)
    const session = (await authed.json()) as { user: { id: string; email: string } }
    expect(session.user.id).toBe(user.id)
    expect(session.user.email).toBe(user.email)

    const anon = await t.request('/api/auth/get-session')
    expect(anon.status).toBe(200)
    expect(await anon.json()).toBeNull()
  })

  it('sign-out invalidates the session', async () => {
    const { headers } = await registerUser(t)

    const out = await t.request('/api/auth/sign-out', { method: 'POST', headers })
    expect(out.status).toBe(200)

    const after = await t.request('/api/auth/get-session', { headers })
    expect(await after.json()).toBeNull()
  })
})

describe('requireAuth guard', () => {
  const probe = new Hono<{ Bindings: AppBindings }>()
  probe.onError(onError)
  probe.use('*', requireAuth)
  probe.get('/', (c) => c.json({ ok: true }))

  async function probeRequest(headers?: HeadersInit): Promise<Response> {
    return await probe.request('/', { headers }, t.bindings as AppBindings)
  }

  it('returns the 401 envelope without a session cookie', async () => {
    const res = await probeRequest()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    })
  })

  it('passes through with a valid session cookie', async () => {
    const { headers } = await registerUser(t)
    const res = await probeRequest(headers)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
