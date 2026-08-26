import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { PrismaClient } from '../generated/prisma/client';
import type { AppBindings, AppEnv } from './env';
import { seedDefaultCategories } from '../api/categories/service';

/**
 * Auth env subset read from request bindings. Never `process.env`: on Workers
 * env only exists per-request, so callers construct auth lazily per call.
 */
type AuthEnv = Pick<AppBindings, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'>;

/**
 * Memoized instances per (db, env) pair. betterAuth() resolves plugins and
 * schema on construction; rebuilding it per request is pure overhead, and
 * prisma.ts already keeps one client per DATABASE_URL isolate-lifetime.
 */
const authCache = new WeakMap<PrismaClient, Map<string, ReturnType<typeof buildAuth>>>();

/**
 * Better Auth instance factory (ticket #5). Open email/password signup, no
 * email verification or password reset (out of scope per spec #1). Sessions
 * live in Postgres via the prismaAdapter.
 *
 * The `bearer` plugin lets native clients (the Flutter app) authenticate with
 * `Authorization: Bearer <token>` instead of replaying cookies: sign-in/up
 * responses carry the token in the `set-auth-token` header, and every other
 * endpoint accepts the bearer form. Web clients keep using plain cookies.
 */
function buildAuth(db: PrismaClient, env: AuthEnv) {
    return betterAuth({
        database: prismaAdapter(db, { provider: 'postgresql' }),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        emailAndPassword: { enabled: true },
        plugins: [bearer()],
        databaseHooks: {
            user: {
                create: {
                    // Ticket #6: seed the default categories so categorization works
                    // from day one (spec #1, story 9).
                    after: async (user) => {
                        await seedDefaultCategories(db, user.id);
                    },
                },
            },
        },
    });
}

/**
 * Memoizing accessor: one Better Auth instance per (db, secret, baseURL).
 * Call sites (auth passthrough router, requireAuth) stay per-request simple.
 */
export function createAuth(db: PrismaClient, env: AuthEnv) {
    let byEnv = authCache.get(db);
    if (!byEnv) {
        byEnv = new Map();
        authCache.set(db, byEnv);
    }
    const key = `${env.BETTER_AUTH_SECRET}|${env.BETTER_AUTH_URL ?? ''}`;
    let auth = byEnv.get(key);
    if (!auth) {
        auth = buildAuth(db, env);
        byEnv.set(key, auth);
    }
    return auth;
}

/**
 * Session guard for resource routers (ticket #5). Resolves the Better Auth
 * session from the request cookies or `Authorization: Bearer` header;
 * short-circuits with a 401 envelope when absent or expired. Stores the
 * session userId on context (AppEnv Variables) for downstream controllers.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
    const session = await createAuth(c.get('db'), c.env).api.getSession({
        headers: c.req.raw.headers,
    });
    if (!session) throw new HTTPException(401);
    c.set('userId', session.user.id);
    await next();
}
