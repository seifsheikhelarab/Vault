import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { TEST_DB_URL } from './db-url';

/**
 * Runs once before all test files: recreate the test database from scratch,
 * then apply committed migrations with `prisma migrate deploy`.
 */
export default async function setup(): Promise<void> {
    // Admin connection targets the same server as TEST_DB_URL, database `postgres`,
    // so a TEST_DATABASE_URL override relocates both together.
    const adminUrl = new URL(TEST_DB_URL);
    adminUrl.pathname = '/postgres';
    const dbName = decodeURIComponent(new URL(TEST_DB_URL).pathname.slice(1));

    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
        // Terminate lingering connections from previous runs so DROP cannot fail.
        await admin.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [dbName],
        );
        await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        await admin.query(`CREATE DATABASE "${dbName}"`);
    } finally {
        await admin.end();
    }

    execSync('bunx prisma migrate deploy', {
        stdio: 'inherit',
        // prisma.config.ts reads DATABASE_URL; globalSetup has no access to
        // worker-provided env, so pass everything explicitly through process.env.
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    });
}
