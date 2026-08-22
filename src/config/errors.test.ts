import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { app } from '../index'
import type { AppBindings } from './env'
import { onError } from './errors'

function errorApp(handler: () => never) {
  const test = new Hono<{ Bindings: AppBindings }>()
  test.get('/boom', handler)
  test.onError(onError)
  return test
}

function request(handler?: () => never): Promise<Response> {
  const target = handler ? errorApp(handler) : app
  return Promise.resolve(target.request('/boom'))
}

describe('onError envelope mapping', () => {
  it('unknown route returns 404 envelope', async () => {
    const res = await request()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found' },
    })
  })

  it('maps 401', async () => {
    const res = await request(() => {
      throw new HTTPException(401, { message: 'No session' })
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'No session' },
    })
  })

  it('maps 409', async () => {
    const res = await request(() => {
      throw new HTTPException(409, { message: 'Category in use' })
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { code: 'CONFLICT', message: 'Category in use' },
    })
  })

  it('maps thrown ZodError to 422 with flattened issues', async () => {
    const schema = z.object({ amountMinor: z.number() })
    const res = await request((): never => {
      const result = schema.safeParse({})
      if (!result.success) throw result.error
      throw new Error('expected validation failure')
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        issues: { fieldErrors: { amountMinor: [expect.any(String)] } },
      },
    })
  })

  it('sanitizes unexpected errors as 500 INTERNAL without leaking details', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await request((): never => {
        throw new Error('secret-db-connection-string')
      })
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toEqual({
        error: { code: 'INTERNAL', message: 'Internal server error' },
      })
      expect(JSON.stringify(body)).not.toContain('secret-db-connection-string')
    } finally {
      spy.mockRestore()
    }
  })

  it('sanitizes thrown HTTPException 500s too', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await request(() => {
        throw new HTTPException(503, { message: 'db down detail' })
      })
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body).toEqual({
        error: { code: 'INTERNAL', message: 'Internal server error' },
      })
      expect(JSON.stringify(body)).not.toContain('db down detail')
    } finally {
      spy.mockRestore()
    }
  })
})
