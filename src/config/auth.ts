import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { PrismaClient } from '../generated/prisma/client'
import type { AppBindings } from './env'
import { createPrisma } from './prisma'

/**
 * Auth env subset read from request bindings. Never `process.env`: on Workers
 * env only exists per-request, so callers construct auth lazily per call.
 */
type AuthEnv = Pick<AppBindings, 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL'>

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
          after: async () => {
            // TODO(ticket #6): seed default categories for the new user.
          },
        },
      },
    },
  })
}

/**
 * Session guard for resource routers (ticket #5). Reads the Better Auth
 * session from the request cookies; short-circuits with a 401 envelope when
 * absent or expired.
 */
export async function requireAuth(
  c: Context<{ Bindings: AppBindings }>,
  next: Next,
): Promise<Response | void> {
  const db = createPrisma(c.env.DATABASE_URL)
  const session = await createAuth(db, c.env).api.getSession({
    headers: c.req.raw.headers,
  })
  if (!session) throw new HTTPException(401)
  await next()
}
