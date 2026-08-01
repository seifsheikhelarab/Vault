/**
 * Cleanup script to remove lingering "Test Category" entries
 * from the categories table. Run this when test data has
 * accumulated in the database due to interrupted test runs.
 *
 * Usage: npx tsx cleanup-tests.ts
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
}

const client = postgres(url);
const db = drizzle(client, { schema });

async function cleanup() {
    console.log('Cleaning up test categories...');
    const deleted = await db
        .delete(schema.categories)
        .where(eq(schema.categories.name, 'Test Category'))
        .returning({ id: schema.categories.id });
    console.log(`  Deleted ${deleted.length} "Test Category" entries`);
    console.log('Done.');
    await client.end();
}

cleanup().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
