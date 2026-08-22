import app from '../index'
import { createPrisma } from '../config/prisma'
import type { AppBindings } from '../config/env'
import type { ParseExpense } from '../api/chat/service'
import { TEST_DB_URL } from './db-url'

/**
 * Test harness helpers.
 *
 * Conventions (spec #1, Testing Decisions):
 * - Tests assert external behavior only: HTTP request in via `app.request()`,
 *   status/body/DB state out. No mocks except the GoogleGenAI module — it is
 *   the ONLY mock ever allowed.
 * - Clock seam: services that depend on time take an explicit `now: Date`
 *   parameter; only the cron handler uses the real clock. Tests pass
 *   `fixedNow` (or a locally constructed Date) to pin time deterministically.
 *   Never reach for fake timers in DB-backed tests.
 */

/** Deterministic clock for tests of time-dependent services. */
export const fixedNow: Date = new Date('2026-01-15T12:00:00.000Z')

/**
 * Full runtime env shape: wrangler vars/secrets (DATABASE_URL, auth, Gemini)
 * plus bindings. Secrets are not declared in wrangler.jsonc yet (ticket #5),
 * so this extends the generated CloudflareBindings.
 */
type TestBindings = CloudflareBindings & {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  GEMINI_API_KEY: string
  /** Chat parser seam (ticket #12): stub this to fake Gemini output. */
  parseExpense?: ParseExpense
}

/**
 * Build the real app + a Prisma client pointed at the test database.
 * `overrides` replace individual bindings (e.g. a different DATABASE_URL or
 * GEMINI_API_KEY). The returned `request()` injects those bindings into every
 * call, standing in for the Workers runtime env.
 */
export function buildApp(overrides: Partial<Omit<TestBindings, 'HYPERDRIVE'>> = {}) {
  const bindings: TestBindings = {
    DATABASE_URL: TEST_DB_URL,
    BETTER_AUTH_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    BETTER_AUTH_URL: 'http://localhost:8787',
    GEMINI_API_KEY: 'test-gemini-key',
    // No route consumes Hyperdrive yet; routes go through DATABASE_URL directly
    // in tests (spec #1: Prisma connects directly, no Hyperdrive).
    HYPERDRIVE: {} as CloudflareBindings['HYPERDRIVE'],
    ...overrides,
  }
  const db = createPrisma(bindings.DATABASE_URL)
  return {
    db,
    bindings,
    async request(path: string, init?: RequestInit): Promise<Response> {
      return await app.request(path, init, bindings as unknown as AppBindings)
    },
  }
}

/**
 * Wipe all data between tests while keeping the schema: truncate every public
 * table (auth tables included) and restart identities. Call in `beforeEach`.
 */
export async function truncateAll(db: ReturnType<typeof createPrisma>): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (rows.length === 0) return
  const tables = rows.map((r) => `"${r.tablename}"`).join(', ')
  await db.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`)
}
