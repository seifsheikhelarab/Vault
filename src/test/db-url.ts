/**
 * Single source of truth for the test database URL.
 *
 * Override with TEST_DATABASE_URL so parallel agents/runs get isolated
 * databases, e.g.:
 *   TEST_DATABASE_URL=postgresql://postgres:admin@localhost:5432/vault_test_2 \
 *     bunx vitest run
 */
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:admin@localhost:5432/vault_test'
