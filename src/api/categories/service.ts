import { HTTPException } from 'hono/http-exception'
import { Prisma, type PrismaClient } from '../../generated/prisma/client'
import { deleteOwnedOr404, findOwnedOr404 } from '../../utils/ownership'

/**
 * Categories service (ticket #6). All queries are scoped by userId; a missing
 * or foreign row is indistinguishable (404) so ids stay unenumerable.
 */

export const DEFAULT_CATEGORY_NAMES = [
  'Groceries',
  'Transport',
  'Dining',
  'Entertainment',
  'Bills',
  'Health',
  'Shopping',
  'Other',
] as const

/** Signup hook (ticket #6 deliverable): seed the default categories. */
export async function seedDefaultCategories(db: PrismaClient, userId: string): Promise<void> {
  await db.category.createMany({
    data: DEFAULT_CATEGORY_NAMES.map((name) => ({ userId, name })),
  })
}

function throwConflict(error: unknown): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new HTTPException(409, { message: 'Category already exists' })
  }
  throw error
}

export async function createCategory(
  db: PrismaClient,
  userId: string,
  input: { name: string },
) {
  try {
    return await db.category.create({ data: { userId, name: input.name } })
  } catch (error) {
    throwConflict(error)
  }
}

export async function listCategories(db: PrismaClient, userId: string) {
  // Name tie-break keeps ordering deterministic when rows share a timestamp
  // (seeded defaults are inserted in one statement).
  return await db.category.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
  })
}

export async function getCategory(db: PrismaClient, userId: string, id: string) {
  return await findOwnedOr404(db.category, userId, id)
}

export async function updateCategory(
  db: PrismaClient,
  userId: string,
  id: string,
  input: { name: string },
) {
  await findOwnedOr404(db.category, userId, id)
  try {
    return await db.category.update({ where: { id }, data: { name: input.name } })
  } catch (error) {
    throwConflict(error)
  }
}

/**
 * Delete semantics (ticket #6): hard delete. Category has no deletedAt column
 * and the schema already declares onDelete: SetNull on expense/budget/
 * recurring categoryId FKs, so the database nulls those references itself —
 * no soft-delete layer added on top.
 */
export async function deleteCategory(db: PrismaClient, userId: string, id: string): Promise<void> {
  await deleteOwnedOr404(db.category, userId, id)
}
