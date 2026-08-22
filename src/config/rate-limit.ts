import type { Context, Next } from 'hono'

// ponytail: in-memory buckets are per-isolate on Workers and never shrink;
// swap for a durable limiter (e.g. Durable Objects) if abuse or memory becomes real
const WINDOW_MS = 60 * 1000
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(limit: number) {
  return async (c: Context, next: Next) => {
    const key = `${limit}:${c.req.header('x-forwarded-for') ?? 'anonymous'}`
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
      buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    } else if (++bucket.count > limit) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429)
    }
    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - (buckets.get(key)?.count ?? 1))))
    await next()
  }
}

export const globalRateLimit = rateLimit(120)
export const strictRateLimit = rateLimit(10)

/** Test-only: clear all buckets so suites start with a fresh budget. */
export function resetRateLimits(): void {
  buckets.clear()
}
