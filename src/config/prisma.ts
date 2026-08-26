import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * One PrismaClient per connection string, reused across requests in the
 * isolate. A fresh client (and pg pool) per request exhausts Postgres
 * max_connections under load; the isolate-lifetime map keeps the count at
 * one per distinct DATABASE_URL.
 */
const clients = new Map<string, PrismaClient>();

/**
 * Hyperdrive's connection string when the binding exists, else DATABASE_URL.
 * Tests inject HYPERDRIVE as an empty object, so DATABASE_URL still wins there.
 */
export function resolveDatabaseUrl(env: {
    DATABASE_URL: string;
    HYPERDRIVE?: { connectionString?: string };
}): string {
    return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
}

export function createPrisma(databaseUrl: string): PrismaClient {
    let client = clients.get(databaseUrl);
    if (!client) {
        // Workers caps ~6 concurrent outbound TCP streams per isolate; pg's
        // default max=10 can deadlock (new connections queued behind held
        // ones). Stale idle sockets handed out after an isolate freeze hang
        // silently until the runtime kills the request ("code had hung") —
        // no app-level log is possible there, so every knob below exists to
        // turn that silent hang into a thrown, logged error instead.
        const adapter = new PrismaPg({
            connectionString: databaseUrl,
            max: 5,
            maxUses: 1,
            connectionTimeoutMillis: 10_000,
            idleTimeoutMillis: 30_000,
            statement_timeout: 10_000,
            query_timeout: 15_000,
            keepAlive: true,
        });
        client = new PrismaClient({ adapter });
        clients.set(databaseUrl, client);
    }
    return client;
}
