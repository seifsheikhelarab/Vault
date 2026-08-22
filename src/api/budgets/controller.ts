import type { Context } from 'hono'
import type { AppEnv } from '../../config/env'
import {
  createBudget,
  deleteBudget,
  getBudget,
  getBudgetProgress,
  listBudgets,
  updateBudget,
} from './service'
import type { CreateBudgetInput, UpdateBudgetInput } from './validation'

/**
 * Budgets controllers (ticket #8). Thin like categories/expenses: session
 * userId plus validated inputs in, service call, bare resource/list out.
 */

export async function createBudgetController(c: Context<AppEnv>, input: CreateBudgetInput) {
  const db = c.get('db')
  return c.json(await createBudget(db, c.get('userId'), input), 201)
}

export async function listBudgetsController(c: Context<AppEnv>) {
  const db = c.get('db')
  return c.json(await listBudgets(db, c.get('userId')))
}

export async function getBudgetController(c: Context<AppEnv>, id: string) {
  const db = c.get('db')
  return c.json(await getBudget(db, c.get('userId'), id))
}

export async function updateBudgetController(
  c: Context<AppEnv>,
  id: string,
  input: UpdateBudgetInput,
) {
  const db = c.get('db')
  return c.json(await updateBudget(db, c.get('userId'), id, input))
}

export async function deleteBudgetController(c: Context<AppEnv>, id: string) {
  const db = c.get('db')
  await deleteBudget(db, c.get('userId'), id)
  return c.body(null, 204)
}

export async function budgetProgressController(
  c: Context<AppEnv>,
  query: { date?: string },
) {
  const db = c.get('db')
  return c.json(await getBudgetProgress(db, c.get('userId'), query.date))
}
