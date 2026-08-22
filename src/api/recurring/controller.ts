import type { Context } from 'hono'
import type { AppEnv } from '../../config/env'
import { createPrisma } from '../../config/prisma'
import {
  createDefinition,
  deleteDefinition,
  getDefinition,
  listDefinitions,
  updateDefinition,
} from './service'
import type { CreateRecurringInput, UpdateRecurringInput } from './validation'

/**
 * Recurring controllers (ticket #9). Thin like expenses: session userId plus
 * validated inputs in, service call, bare resource/list out.
 */

export async function createRecurringController(c: Context<AppEnv>, input: CreateRecurringInput) {
  const db = createPrisma(c.env.DATABASE_URL)
  return c.json(await createDefinition(db, c.get('userId'), input), 201)
}

export async function listRecurringController(c: Context<AppEnv>) {
  const db = createPrisma(c.env.DATABASE_URL)
  return c.json(await listDefinitions(db, c.get('userId')))
}

export async function getRecurringController(c: Context<AppEnv>, id: string) {
  const db = createPrisma(c.env.DATABASE_URL)
  return c.json(await getDefinition(db, c.get('userId'), id))
}

export async function updateRecurringController(
  c: Context<AppEnv>,
  id: string,
  input: UpdateRecurringInput,
) {
  const db = createPrisma(c.env.DATABASE_URL)
  return c.json(await updateDefinition(db, c.get('userId'), id, input))
}

export async function deleteRecurringController(c: Context<AppEnv>, id: string) {
  const db = createPrisma(c.env.DATABASE_URL)
  await deleteDefinition(db, c.get('userId'), id)
  return c.body(null, 204)
}
