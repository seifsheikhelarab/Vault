import type { PrismaClient } from '../generated/prisma/client'
import type { ParseExpense } from '../api/chat/service'

/**
 * Full runtime env the app expects at request time. Secrets are not declared
 * in wrangler.jsonc (they arrive via `wrangler secret put` / `.dev.vars`), so
 * this widens the generated CloudflareBindings with the keys routes read.
 */
export type AppBindings = CloudflareBindings & {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
  GEMINI_API_KEY?: string
  /**
   * Ticket #12 injection seam: overrides the production Gemini parser.
   * Tests stub this through binding overrides; production never sets it,
   * so the chat controller falls back to createGeminiParser(GEMINI_API_KEY).
   */
  parseExpense?: ParseExpense
}

/**
 * Hono env for resource routers: bindings plus the session userId requireAuth
 * stores on context and the request-scoped Prisma client set by the api
 * aggregator middleware.
 */
export type AppEnv = {
  Bindings: AppBindings
  Variables: { userId: string; db: PrismaClient }
}
