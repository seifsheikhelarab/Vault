import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

/**
 * One PrismaClient per connection string, memoized for the isolate's lifetime.
 * Controllers used to call this per request, leaking a pg pool every time
 * until Postgres hit max_connections (P2037); Workers encourages caching
 * clients in global scope, so the factory does it here once for everyone.
 */
const cache = new Map<string, PrismaClient>()

export function createPrisma(databaseUrl: string): PrismaClient {
  const existing = cache.get(databaseUrl)
  if (existing) return existing
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  cache.set(databaseUrl, client)
  return client
}
