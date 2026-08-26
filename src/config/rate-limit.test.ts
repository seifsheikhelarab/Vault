import { describe, beforeEach, expect, it } from 'vitest';
import { Hono } from 'hono';
import { rateLimit, resetRateLimits } from './rate-limit';

// Rate-limit keying: CF-Connecting-IP (edge-set, unspoofable) wins;
// x-forwarded-for is only the fallback for non-CF origins. Uses the strict
// tier so exhaustion is reachable quickly (limit 10/minute).

function limitApp() {
    const app = new Hono();
    app.use('*', rateLimit('strict'));
    app.get('/', (c) => c.text('ok'));
    return app;
}

beforeEach(() => {
    resetRateLimits();
});

describe('rateLimit key source', () => {
    it('keys on CF-Connecting-IP over x-forwarded-for', async () => {
        const app = limitApp();
        const headers = (cfIp: string) =>
            new Headers({ 'CF-Connecting-IP': cfIp, 'x-forwarded-for': '9.9.9.9' });
        // Exhaust 1.1.1.1's budget; 2.2.2.2 must still pass afterwards.
        for (let i = 0; i < 10; i++) {
            expect((await app.request('/', { headers: headers('1.1.1.1') })).status).toBe(200);
        }
        // Different CF IPs are different buckets despite identical XFF.
        expect((await app.request('/', { headers: headers('2.2.2.2') })).status).toBe(200);
        expect((await app.request('/', { headers: headers('1.1.1.1') })).status).toBe(429);
    });

    it('falls back to x-forwarded-for when CF-Connecting-IP is absent', async () => {
        const app = limitApp();
        const req = () =>
            app.request('/', { headers: new Headers({ 'x-forwarded-for': '3.3.3.3' }) });
        for (let i = 0; i < 10; i++) {
            expect((await req()).status).toBe(200);
        }
        expect((await req()).status).toBe(429);
    });

    it('ignores a client-spoofed CF-Connecting-IP mismatch by treating XFF alone as its own bucket', async () => {
        const app = limitApp();
        const xffOnly = new Headers({ 'x-forwarded-for': '4.4.4.4' });
        for (let i = 0; i < 10; i++) {
            expect((await app.request('/', { headers: xffOnly })).status).toBe(200);
        }
        // Same XFF as above but a different CF IP ⇒ separate bucket, still ok.
        const withCf = new Headers({ 'CF-Connecting-IP': '5.5.5.5', 'x-forwarded-for': '4.4.4.4' });
        expect((await app.request('/', { headers: withCf })).status).toBe(200);
        expect((await app.request('/', { headers: xffOnly })).status).toBe(429);
    });
});
