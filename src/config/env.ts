import { z } from 'zod'
import type { ParseExpense } from '../api/chat/service'

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url().optional(),
})

export type Env = z.infer<typeof envSchema>

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
 * stores on context for downstream controllers.
 */
export type AppEnv = {
  Bindings: AppBindings
  Variables: { userId: string }
}

export function parseEnv(bindings: CloudflareBindings): Env {
  const result = envSchema.safeParse(bindings)
  if (!result.success) {
    const missing = Object.keys(z.flattenError(result.error).fieldErrors).join(', ')
    throw new Error(`Invalid environment variables: ${missing}`)
  }
  return result.data
}
