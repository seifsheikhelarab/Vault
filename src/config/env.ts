import { z } from 'zod'

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url().optional(),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(bindings: CloudflareBindings): Env {
  const result = envSchema.safeParse(bindings)
  if (!result.success) {
    const missing = Object.keys(z.flattenError(result.error).fieldErrors).join(', ')
    throw new Error(`Invalid environment variables: ${missing}`)
  }
  return result.data
}
