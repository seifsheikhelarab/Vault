import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        // Run test files sequentially — all tests share one Postgres DB
        // and parallel files cause FK violations / spurious 500s.
        fileParallelism: false,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        testTimeout: 10_000,
        hookTimeout: 15_000,
        env: {
            DATABASE_URL:
                'postgres://postgres:admin@localhost:5432/splitwise_test',
            BETTER_AUTH_URL: 'http://localhost:3001/api/auth',
            BETTER_AUTH_SECRET:
                'test-secret-key-for-development-only-not-for-production',
            NODE_ENV: 'test'
        }
    }
});
