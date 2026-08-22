import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './src/test/global-setup.ts',
    pool: 'forks', // each worker is a separate process; DB shared, truncate between tests
    // Workers share one database and truncateAll wipes everything between
    // tests, so parallel files truncate each other's rows mid-request.
    // Serialize until per-worker schemas/databases exist.
    fileParallelism: false,
  },
})
