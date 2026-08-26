import type { Context, Next } from 'hono';

/**
 * Workers ratelimit binding shape (the subset this module uses). Bindings are
 * declared in wrangler.jsonc `ratelimits` and enforced at Cloudflare's edge,
 * so limits hold across all isolates. Absent binding (tests, local dev
 * without the config) falls back to per-isolate in-memory buckets.
 */
export interface RateLimiter {
    limit(key: { key: string }): Promise<{ success: boolean }>;
}

const WINDOW_MS = 60 * 1000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitTier = 'strict' | 'general';

const TIER_LIMITS: Record<RateLimitTier, number> = { strict: 10, general: 120 };

/** In-memory fallback; returns false when the request is over budget. */
function memoryAllow(key: string, limit: number): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        if (buckets.size > 10_000)
            for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
        buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    return ++bucket.count <= limit;
}

export function rateLimit(tier: RateLimitTier) {
    const limit = TIER_LIMITS[tier];
    return async (
        c: Context<{
            Bindings: { RATE_LIMIT_STRICT?: RateLimiter; RATE_LIMIT_GENERAL?: RateLimiter };
        }>,
        next: Next,
    ) => {
        // CF-Connecting-IP is set by Cloudflare's edge and cannot be spoofed by
        // clients; x-forwarded-for is only a fallback for non-CF origins.
        const ip =
            c.req.header('CF-Connecting-IP') ?? c.req.header('x-forwarded-for') ?? 'anonymous';
        const key = `${tier}:${ip}`;
        const binding = tier === 'strict' ? c.env?.RATE_LIMIT_STRICT : c.env?.RATE_LIMIT_GENERAL;
        const ok = binding ? (await binding.limit({ key: ip })).success : memoryAllow(key, limit);
        c.header('X-RateLimit-Limit', String(limit));
        // Remaining is only knowable on the memory path (the edge binding does
        // not report it); the client reads neither header today.
        if (!binding) {
            c.header('X-RateLimit-Remaining', String(Math.max(0, limit - readCount(key))));
        }
        if (!ok) {
            return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429);
        }
        await next();
    };
}

function readCount(key: string): number {
    return buckets.get(key)?.count ?? 1;
}

export const globalRateLimit = rateLimit('general');
export const strictRateLimit = rateLimit('strict');

/** Test-only: clear all buckets so suites start with a fresh budget. */
export function resetRateLimits(): void {
    buckets.clear();
}
