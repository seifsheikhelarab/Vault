import type { Context } from 'hono'
import type { AppEnv } from '../../config/env'
import { pullChanges, pushBatch } from './service'
import type { PullQuery, PushBatch } from './validation'

/**
 * Sync controllers (ticket #13). Thin like every resource: session userId plus
 * validated inputs in, service call, JSON out.
 */

export async function pushController(c: Context<AppEnv>, input: PushBatch) {
  const db = c.get('db')
  return c.json(await pushBatch(db, c.get('userId'), input))
}

export async function pullController(c: Context<AppEnv>, query: PullQuery) {
  const db = c.get('db')
  return c.json(await pullChanges(db, c.get('userId'), query))
}
