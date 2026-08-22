import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

/**
 * One PrismaClient per connection string, reused across requests in the
 * isolate. A fresh client (and pg pool) per request exhausts Postgres
 * max_connections under load; the isolate-lifetime map keeps the count at
 * one per distinct DATABASE_URL.
 */
const clients = new Map<string, PrismaClient>()

/**
 * Hyperdrive's connection string when the binding exists, else DATABASE_URL.
 * Tests inject HYPERDRIVE as an empty object, so DATABASE_URL still wins there.
 */
export function resolveDatabaseUrl(env: {
  DATABASE_URL: string
  HYPERDRIVE?: { connectionString?: string }
}): string {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL
}

export function createPrisma(databaseUrl: string): PrismaClient {
  let client = clients.get(databaseUrl)
  if (!client) {
    const adapter = new PrismaPg({ connectionString: databaseUrl })
    client = new PrismaClient({ adapter })
    clients.set(databaseUrl, client)
  }
  return client
}
