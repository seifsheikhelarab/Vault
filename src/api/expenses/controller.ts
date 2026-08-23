import type { Context } from 'hono';
import type { AppEnv } from '../../config/env';
import { createExpense, deleteExpense, getExpense, listExpenses, updateExpense } from './service';
import type { CreateExpenseInput, ListExpensesQuery, UpdateExpenseInput } from './validation';

/**
 * Expenses controllers (ticket #7). Thin like categories: session userId plus
 * validated inputs in, service call, bare resource/list out. `now` is the
 * clock seam (spec #1 Testing Decisions) for occurredAt/deletedAt defaults.
 */

export async function createExpenseController(c: Context<AppEnv>, input: CreateExpenseInput) {
    const db = c.get('db');
    const { expense, created } = await createExpense(db, c.get('userId'), input, new Date());
    return c.json(expense, created ? 201 : 200);
}

export async function listExpensesController(c: Context<AppEnv>, query: ListExpensesQuery) {
    const db = c.get('db');
    return c.json(await listExpenses(db, c.get('userId'), query));
}

export async function getExpenseController(c: Context<AppEnv>, id: string) {
    const db = c.get('db');
    return c.json(await getExpense(db, c.get('userId'), id));
}

export async function updateExpenseController(
    c: Context<AppEnv>,
    id: string,
    input: UpdateExpenseInput,
) {
    const db = c.get('db');
    return c.json(await updateExpense(db, c.get('userId'), id, input));
}

export async function deleteExpenseController(c: Context<AppEnv>, id: string) {
    const db = c.get('db');
    await deleteExpense(db, c.get('userId'), id, new Date());
    return c.body(null, 204);
}
