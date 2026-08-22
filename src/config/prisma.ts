import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

/**
 * One PrismaClient per connection string, reused across requests in the
 * isolate. A fresh client (and pg pool) per request exhausts Postgres
 * max_connections under load; the isolate-lifetime map keeps the count at
 * one per distinct DATABASE_URL.
 */
const clients = new Map<string, PrismaClient>()

export function createPrisma(databaseUrl: string): PrismaClient {
  let client = clients.get(databaseUrl)
  if (!client) {
    const adapter = new PrismaPg({ connectionString: databaseUrl })
    client = new PrismaClient({ adapter })
    clients.set(databaseUrl, client)
  }
  return client
}
