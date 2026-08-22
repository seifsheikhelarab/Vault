import { describe, expect, it } from 'vitest'
import { resolveDatabaseUrl } from './prisma'

describe('resolveDatabaseUrl', () => {
  it('prefers the Hyperdrive connection string when present', () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: 'postgres://direct',
        HYPERDRIVE: { connectionString: 'postgres://hyperdrive' },
      }),
    ).toBe('postgres://hyperdrive')
  })

  it('falls back to DATABASE_URL without or with an empty Hyperdrive binding', () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgres://direct' })).toBe('postgres://direct')
    expect(
      resolveDatabaseUrl({ DATABASE_URL: 'postgres://direct', HYPERDRIVE: {} }),
    ).toBe('postgres://direct')
  })
})
