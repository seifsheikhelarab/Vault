import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

const isTest = process.env.NODE_ENV === 'test';

const queryClient = postgres(process.env.DATABASE_URL!, {
    // In tests, use a single connection so db.insert() in test helpers
    // and db.select() in app.request() API handlers always share the
    // same backend — no pool-related visibility gaps.
    max: isTest ? 1 : undefined,
    // Skip server-side prepared statements in tests (connection-scoped,
    // pointless overhead when max=1).
    prepare: !isTest
});
export const db = drizzle({ client: queryClient, schema });
