import { HTTPException } from 'hono/http-exception';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { assertCategoryOwned, serializeAmountMinor } from '../../utils/ownership';
import type { CreateExpenseInput, ListExpensesQuery, UpdateExpenseInput } from './validation';

/**
 * Expenses service (ticket #7). All queries are scoped by userId; a missing,
 * foreign, or tombstoned row is indistinguishable (404). Deletes are soft:
 * deletedAt tombstones hide rows from reads but keep them for sync (ticket #10).
 * amountMinor crosses the API as a JSON number (validated within the safe
 * integer range) and becomes BigInt here at the service boundary.
 */

type ExpenseRow = Prisma.ExpenseGetPayload<Record<string, never>>;

function samePayload(row: ExpenseRow, userId: string, input: CreateExpenseInput): boolean {
    return (
        row.userId === userId &&
        row.amountMinor === BigInt(input.amountMinor) &&
        row.categoryId === (input.categoryId ?? null) &&
        row.note === (input.note ?? null) &&
        row.occurredAt.getTime() ===
            new Date(input.occurredAt ?? row.occurredAt.toISOString()).getTime()
    );
}

export async function createExpense(
    db: PrismaClient,
    userId: string,
    input: CreateExpenseInput,
    now: Date,
) {
    if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId);

    // Idempotent create (spec #1: client-minted UUID): same id + same payload
    // replays as success; same id + different payload is a conflict.
    const existing = await db.expense.findUnique({ where: { id: input.id } });
    if (existing) {
        if (existing.deletedAt || !samePayload(existing, userId, input)) {
            throw new HTTPException(409, {
                message: 'Expense id already used with a different payload',
            });
        }
        return { expense: serializeAmountMinor(existing), created: false };
    }

    try {
        const row = await db.expense.create({
            data: {
                id: input.id,
                userId,
                amountMinor: BigInt(input.amountMinor),
                categoryId: input.categoryId ?? null,
                occurredAt: input.occurredAt ? new Date(input.occurredAt) : now,
                note: input.note ?? null,
            },
        });
        return { expense: serializeAmountMinor(row), created: true };
    } catch (error) {
        // Lost an id race with another create; treat as conflicting replay.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new HTTPException(409, {
                message: 'Expense id already used with a different payload',
            });
        }
        throw error;
    }
}

// --- Keyset cursor: base64url(`${occurredAt ISO}|${id}`) ---

export function encodeCursor(occurredAt: Date, id: string): string {
    return btoa(`${occurredAt.toISOString()}|${id}`)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}

export function decodeCursor(cursor: string): { occurredAt: Date; id: string } {
    let raw: string;
    try {
        const b64 = cursor.replaceAll('-', '+').replaceAll('_', '/');
        raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    } catch {
        throw new HTTPException(422, { message: 'Invalid cursor' });
    }
    const [occurredAt, id] = raw.split('|');
    if (!occurredAt || !id || Number.isNaN(Date.parse(occurredAt))) {
        throw new HTTPException(422, { message: 'Invalid cursor' });
    }
    return { occurredAt: new Date(occurredAt), id };
}

export async function listExpenses(db: PrismaClient, userId: string, query: ListExpensesQuery) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    // Fetch limit+1 to learn whether a further page exists, so nextCursor goes
    // null exactly on the last page.
    const take = query.limit + 1;
    const rows = await db.expense.findMany({
        where: {
            userId,
            deletedAt: null,
            ...(cursor && {
                OR: [
                    { occurredAt: { lt: cursor.occurredAt } },
                    { occurredAt: cursor.occurredAt, id: { lt: cursor.id } },
                ],
            }),
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take,
    });

    const hasMore = rows.length > take - 1;
    const page = rows.slice(0, take - 1);
    const last = page[page.length - 1];
    return {
        items: page.map(serializeAmountMinor),
        nextCursor: hasMore && last ? encodeCursor(last.occurredAt, last.id) : null,
    };
}

/** Local: the shared findOwnedOr404 has no deletedAt filter (live-only here). */
async function findOwnedLive(db: PrismaClient, userId: string, id: string) {
    const expense = await db.expense.findFirst({ where: { id, userId, deletedAt: null } });
    if (!expense) throw new HTTPException(404);
    return expense;
}

export async function getExpense(db: PrismaClient, userId: string, id: string) {
    return serializeAmountMinor(await findOwnedLive(db, userId, id));
}

export async function updateExpense(
    db: PrismaClient,
    userId: string,
    id: string,
    input: UpdateExpenseInput,
) {
    await findOwnedLive(db, userId, id);
    if (input.categoryId) await assertCategoryOwned(db, userId, input.categoryId);
    // @updatedAt bumps updatedAt on every write (sync ticket #10 depends on it).
    const row = await db.expense.update({
        where: { id },
        data: {
            ...(input.amountMinor !== undefined && { amountMinor: BigInt(input.amountMinor) }),
            ...(input.occurredAt !== undefined && { occurredAt: new Date(input.occurredAt) }),
            ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
            ...(input.note !== undefined && { note: input.note }),
        },
    });
    return serializeAmountMinor(row);
}

/**
 * Delete semantics (ticket #7): tombstone only. deletedAt set on a live owned
 * row; the row itself survives so sync can propagate the deletion.
 */
export async function deleteExpense(db: PrismaClient, userId: string, id: string, now: Date) {
    const result = await db.expense.updateMany({
        where: { id, userId, deletedAt: null },
        data: { deletedAt: now },
    });
    if (result.count === 0) throw new HTTPException(404);
}
