import { z } from 'zod'

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
}

export function parseEnv(bindings: CloudflareBindings): Env {
  const result = envSchema.safeParse(bindings)
  if (!result.success) {
    const missing = Object.keys(z.flattenError(result.error).fieldErrors).join(', ')
    throw new Error(`Invalid environment variables: ${missing}`)
  }
  return result.data
}
