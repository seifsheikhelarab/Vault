import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './src/test/global-setup.ts',
    pool: 'forks', // each worker is a separate process; DB shared, truncate between tests
    fileParallelism: true,
  },
})
