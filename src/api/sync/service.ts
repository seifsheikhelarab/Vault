import { HTTPException } from 'hono/http-exception';
import { Prisma, type PrismaClient } from '../../generated/prisma/client';
import { decodeCursor, encodeCursor } from '../expenses/service';
import { serializeAmountMinor } from '../../utils/ownership';
import type { PullQuery, PushBatch, PushCategoryItem, PushExpenseItem } from './validation';

/**
 * Sync service (ticket #13). Last-writer-wins batch push + incremental pull.
 *
 * LWW merge rule: the server row survives when its updatedAt is >= the
 * incoming client updatedAt — equal timestamps resolve in the SERVER's favor
 * (documented tie-break; makes replays of an already-applied item idempotent).
 * An unknown id is created. A foreign id is reported conflict-lost without
 * touching data (existence stays unenumerable, same as 404 elsewhere).
 *
 * Scope: expenses + categories only. Budgets are skipped for this ticket
 * (they lack offline-first stories in spec #1); extend push/pull here when
 * budget sync lands.
 *
 * Category deletes: the schema has no deletedAt column (ticket #6 chose hard
 * deletes), so a tombstoned category item DELETES the row and a delete for an
 * unknown id is a no-op 'accepted'. That keeps re-pushed batches idempotent,
 * but a hard-deleted category cannot propagate to other devices via pull —
 * expenses are the source of truth for deletion propagation.
 */

export type SyncOutcome = 'accepted' | 'conflict-lost';

export type PushResult = { id: string; outcome: SyncOutcome };

type Tx = Prisma.TransactionClient;

async function applyCategory(tx: Tx, userId: string, item: PushCategoryItem): Promise<SyncOutcome> {
    const incoming = new Date(item.updatedAt);
    const existing = await tx.category.findUnique({ where: { id: item.id } });
    if (!existing) {
        // Tombstone for an unknown id: nothing to delete, already gone everywhere.
        if (item.deletedAt) return 'accepted';
        try {
            await tx.category.create({
                data: { id: item.id, userId, name: item.name, updatedAt: incoming },
            });
            return 'accepted';
        } catch (error) {
            // Lost a race on the PK or the per-user unique name.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return 'conflict-lost';
            }
            throw error;
        }
    }
    if (existing.userId !== userId) return 'conflict-lost';
    if (existing.updatedAt.getTime() >= incoming.getTime()) return 'conflict-lost';
    if (item.deletedAt) {
        await tx.category.delete({ where: { id: item.id } });
        return 'accepted';
    }
    try {
        await tx.category.update({
            where: { id: item.id },
            data: { name: item.name, updatedAt: incoming },
        });
        return 'accepted';
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return 'conflict-lost';
        }
        throw error;
    }
}

async function assertCategoryOwned(tx: Tx, userId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const category = await tx.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
        throw new HTTPException(422, { message: `Unknown category ${categoryId} in sync batch` });
    }
}

async function applyExpense(tx: Tx, userId: string, item: PushExpenseItem): Promise<SyncOutcome> {
    const incoming = new Date(item.updatedAt);
    const existing = await tx.expense.findUnique({ where: { id: item.id } });
    if (!existing) {
        if (item.deletedAt) return 'accepted';
        await assertCategoryOwned(tx, userId, item.categoryId);
        try {
            await tx.expense.create({
                data: {
                    id: item.id,
                    userId,
                    amountMinor: BigInt(item.amountMinor),
                    occurredAt: new Date(item.occurredAt),
                    categoryId: item.categoryId ?? null,
                    note: item.note ?? null,
                    deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
                    updatedAt: incoming,
                },
            });
            return 'accepted';
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return 'conflict-lost';
            }
            throw error;
        }
    }
    if (existing.userId !== userId) return 'conflict-lost';
    if (existing.updatedAt.getTime() >= incoming.getTime()) return 'conflict-lost';
    await assertCategoryOwned(tx, userId, item.categoryId);
    await tx.expense.update({
        where: { id: item.id },
        data: {
            amountMinor: BigInt(item.amountMinor),
            occurredAt: new Date(item.occurredAt),
            categoryId: item.categoryId ?? null,
            note: item.note ?? null,
            deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            updatedAt: incoming,
        },
    });
    return 'accepted';
}

/**
 * Apply the whole batch atomically: categories first so expense items can
 * reference categories created in the same batch; one invalid reference fails
 * the entire request with 422 and rolls back every earlier apply.
 */
export async function pushBatch(db: PrismaClient, userId: string, input: PushBatch) {
    return db.$transaction(async (tx) => {
        const results: PushResult[] = [];
        for (const item of input.categories ?? []) {
            results.push({ id: item.id, outcome: await applyCategory(tx, userId, item) });
        }
        for (const item of input.expenses ?? []) {
            results.push({ id: item.id, outcome: await applyExpense(tx, userId, item) });
        }
        return { results };
    });
}

// --- Pull cursor: base64url(`${updatedAt ISO}|${id}`), shared with expenses ---

type Change<T> = { kind: 'expense' | 'category'; row: T };

/**
 * Changes since the cursor across BOTH tables under one watermark:
 * keyset predicate (updatedAt, id) > (cursor.at, cursor.id), ascending walk.
 * Tombstoned expenses are INCLUDED (deletions must propagate); categories have
 * no tombstones. Fetching limit+1 per table then cutting the merge means rows
 * beyond the cut are simply re-fetched next page — inserts arriving mid-walk
 * with newer updatedAt never cause skips or duplicates of pre-cursor rows.
 */
export async function pullChanges(db: PrismaClient, userId: string, query: PullQuery) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const newerThan = cursor && {
        OR: [
            { updatedAt: { gt: cursor.occurredAt } },
            { updatedAt: cursor.occurredAt, id: { gt: cursor.id } },
        ],
    };
    const take = query.limit + 1;
    const [expenseRows, categoryRows] = await Promise.all([
        db.expense.findMany({
            where: { userId, ...newerThan },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            take,
        }),
        db.category.findMany({
            where: { userId, ...newerThan },
            orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
            take,
        }),
    ]);

    type ExpenseRow = (typeof expenseRows)[number];
    type CategoryRow = (typeof categoryRows)[number];
    const merged: Change<ExpenseRow | CategoryRow>[] = [
        ...expenseRows.map((row) => ({ kind: 'expense' as const, row })),
        ...categoryRows.map((row) => ({ kind: 'category' as const, row })),
    ].sort((a, b) => {
        const byTime = a.row.updatedAt.getTime() - b.row.updatedAt.getTime();
        return byTime !== 0 ? byTime : a.row.id < b.row.id ? -1 : 1;
    });

    const hasMore = merged.length > query.limit;
    const page = merged.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
        expenses: page
            .filter((c): c is Change<ExpenseRow> => c.kind === 'expense')
            .map((c) => serializeAmountMinor(c.row)),
        categories: page
            .filter((c): c is Change<CategoryRow> => c.kind === 'category')
            .map((c) => c.row),
        nextCursor: hasMore && last ? encodeCursor(last.row.updatedAt, last.row.id) : null,
    };
}
