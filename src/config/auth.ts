import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
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
 * Better Auth instance factory (ticket #5). Open email/password signup, no
 * email verification or password reset (out of scope per spec #1). Sessions
 * live in Postgres via the prismaAdapter; cookies flow through the handler.
 */
export function createAuth(db: PrismaClient, env: AuthEnv) {
    return betterAuth({
        database: prismaAdapter(db, { provider: 'postgresql' }),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL,
        emailAndPassword: { enabled: true },
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
 * Session guard for resource routers (ticket #5). Reads the Better Auth
 * session from the request cookies; short-circuits with a 401 envelope when
 * absent or expired. Stores the session userId on context (AppEnv Variables)
 * for downstream controllers.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
    const session = await createAuth(c.get('db'), c.env).api.getSession({
        headers: c.req.raw.headers,
    });
    if (!session) throw new HTTPException(401);
    c.set('userId', session.user.id);
    await next();
}
