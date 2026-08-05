import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
    expenses,
    expenseRevisions,
    expenseTombstones,
    splits,
    settlements,
    user
} from '../../lib/db/schema';
import {
    recordAuditEvent,
    AuditAction,
    type AuditContext
} from '../../lib/audit';
import type {
    CreateExpenseInput,
    ReviseExpenseInput,
    DeleteExpenseInput
} from './expense.schema';

const BUSINESS_MAX_CENTS = 100_000_000;

export class ExpenseService {
    create = createExpense;
    list = listExpenses;
    get = getExpense;
    getWithSplits = getExpenseWithSplits;
    revise = reviseExpense;
    delete = deleteExpense;
    getRevisions = getRevisions;
}

// ─── Identity snapshot helper ───────────────────────────────────────────────

async function getUserSnapshot(userId: string) {
    const [u] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
    return {
        name: u?.name ?? 'Unknown',
        email: u?.email ?? 'unknown@unknown'
    };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validatePositiveCents(cents: number, label: string): void {
    if (!Number.isInteger(cents))
        throw new Error(`${label} must be an integer (cents)`);
    if (cents <= 0) throw new Error(`${label} must be positive`);
    if (cents > BUSINESS_MAX_CENTS)
        throw new Error(`${label} exceeds business maximum`);
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createExpense(
    userId: string,
    data: CreateExpenseInput,
    auditCtx: AuditContext
) {
    validatePositiveCents(data.amountCents, 'amountCents');

    const id = crypto.randomUUID();
    const payer = await getUserSnapshot(userId);

    // If splits provided, validate they sum to amountCents
    if (data.splits && data.splits.length > 0) {
        const splitSum = data.splits.reduce((s, sp) => s + sp.amountCents, 0);
        if (splitSum !== data.amountCents) {
            throw new Error(
                `Split total ${splitSum} does not match expense amount ${data.amountCents}`
            );
        }
    }

    await db.transaction(async (tx) => {
        await tx.insert(expenses).values({
            id,
            amountCents: data.amountCents,
            description: data.description,
            date: new Date(data.date),
            receiptUrl: data.receiptUrl ?? null,
            scope: data.scope ?? 'personal',
            userId,
            groupId: data.groupId ?? null,
            categoryId: data.categoryId,
            payerNameSnapshot: payer.name,
            payerEmailSnapshot: payer.email
        });

        // Insert splits
        if (data.splits) {
            for (const sp of data.splits) {
                const snap = await getUserSnapshot(sp.userId);
                await tx.insert(splits).values({
                    id: crypto.randomUUID(),
                    expenseId: id,
                    userId: sp.userId,
                    amountCents: sp.amountCents,
                    userNameSnapshot: snap.name,
                    userEmailSnapshot: snap.email
                });
            }
        }

        await recordAuditEvent(
            auditCtx,
            AuditAction.EXPENSE_CREATED,
            {
                groupId: data.groupId,
                targetType: 'expense',
                targetId: id,
                reason: data.description
            },
            tx
        );
    });

    const [created] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, id));
    return created;
}

// ─── List ───────────────────────────────────────────────────────────────────

export async function listExpenses(params: {
    userId: string;
    groupId?: string;
    scope?: string;
    categoryId?: string;
    page?: number;
    pageSize?: number;
}) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const conditions = [];

    if (params.scope === 'group' && params.groupId) {
        conditions.push(eq(expenses.groupId, params.groupId));
    } else if (params.scope === 'personal') {
        conditions.push(eq(expenses.userId, params.userId));
        conditions.push(isNull(expenses.groupId));
    } else {
        conditions.push(eq(expenses.userId, params.userId));
    }

    if (params.categoryId) {
        conditions.push(eq(expenses.categoryId, params.categoryId));
    }

    // Exclude tombstoned (deleted) expenses from all list views
    conditions.push(
        sql`not exists (select 1 from ${expenseTombstones} where ${expenseTombstones.expenseId} = ${expenses.id})`
    );

    const where = and(...conditions);

    const [total] = await db
        .select({ count: sql<number>`count(*)` })
        .from(expenses)
        .where(where);

    const items = await db
        .select()
        .from(expenses)
        .where(where)
        .orderBy(desc(expenses.date))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

    return { items, total: Number(total?.count ?? 0), page, pageSize };
}

// ─── Get by ID ──────────────────────────────────────────────────────────────

export async function getExpense(id: string) {
    const [expense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, id))
        .limit(1);
    return expense ?? null;
}

// ─── Revise (append-only) ──────────────────────────────────────────────────

export async function reviseExpense(
    expenseId: string,
    userId: string,
    data: ReviseExpenseInput,
    auditCtx: AuditContext
) {
    validatePositiveCents(data.amountCents, 'amountCents');

    const expense = await getExpense(expenseId);
    if (!expense) throw new Error('Expense not found');
    if (expense.userId !== userId)
        throw new Error('Only the payer can revise this expense');

    // Check if expense is tombstoned
    const [tombstone] = await db
        .select()
        .from(expenseTombstones)
        .where(eq(expenseTombstones.expenseId, expenseId))
        .limit(1);
    if (tombstone) throw new Error('Cannot revise a deleted expense');

    // Determine version
    const [latestRev] = await db
        .select({ version: expenseRevisions.version })
        .from(expenseRevisions)
        .where(eq(expenseRevisions.expenseId, expenseId))
        .orderBy(desc(expenseRevisions.version))
        .limit(1);

    const version = (latestRev?.version ?? 0) + 1;
    const revisionId = crypto.randomUUID();
    const author = await getUserSnapshot(userId);

    // Capture before state for audit
    const beforeRef = {
        amountCents: expense.amountCents,
        description: expense.description,
        categoryId: expense.categoryId
    };

    await db.transaction(async (tx) => {
        await tx.insert(expenseRevisions).values({
            id: revisionId,
            expenseId,
            version,
            amountCents: data.amountCents,
            description: data.description,
            categoryId: data.categoryId,
            authorId: userId,
            authorNameSnapshot: author.name,
            authorEmailSnapshot: author.email,
            reason: data.reason
        });

        // Update expense to point to the new revision
        await tx
            .update(expenses)
            .set({
                amountCents: data.amountCents,
                description: data.description,
                categoryId: data.categoryId,
                currentRevisionId: revisionId
            })
            .where(eq(expenses.id, expenseId));

        await recordAuditEvent(
            auditCtx,
            AuditAction.EXPENSE_REVISED,
            {
                groupId: expense.groupId ?? undefined,
                targetType: 'expense',
                targetId: expenseId,
                beforeRef,
                afterRef: {
                    amountCents: data.amountCents,
                    description: data.description,
                    categoryId: data.categoryId,
                    version
                },
                reason: data.reason
            },
            tx
        );
    });

    return getExpense(expenseId);
}

// ─── Delete (tombstone, not hard-delete) ────────────────────────────────────

export async function deleteExpense(
    expenseId: string,
    userId: string,
    data: DeleteExpenseInput,
    auditCtx: AuditContext
) {
    const expense = await getExpense(expenseId);
    if (!expense) throw new Error('Expense not found');
    if (expense.userId !== userId)
        throw new Error('Only the payer can delete this expense');

    // Check if already tombstoned
    const [existing] = await db
        .select()
        .from(expenseTombstones)
        .where(eq(expenseTombstones.expenseId, expenseId))
        .limit(1);
    if (existing) throw new Error('Expense is already deleted');

    // Check that deletion won't invalidate settlements
    // (In a social group, check that the inverse of the current revision
    //  won't make any existing settlement excessive)
    if (expense.groupId) {
        const [settlement] = await db
            .select()
            .from(settlements)
            .where(eq(settlements.groupId, expense.groupId))
            .limit(1);
        if (settlement) {
            // For MVP, warn but allow. Full enforcement would require
            // computing derived balances with and without this expense.
            // Defer to ADR 0029 for complete implementation.
        }
    }

    const author = await getUserSnapshot(userId);
    const tombstoneId = crypto.randomUUID();

    await db.transaction(async (tx) => {
        await tx.insert(expenseTombstones).values({
            id: tombstoneId,
            expenseId,
            authorId: userId,
            authorNameSnapshot: author.name,
            authorEmailSnapshot: author.email,
            reason: data.reason
        });

        await recordAuditEvent(
            auditCtx,
            AuditAction.EXPENSE_DELETED,
            {
                groupId: expense.groupId ?? undefined,
                targetType: 'expense',
                targetId: expenseId,
                reason: data.reason
            },
            tx
        );
    });

    return { deleted: true, tombstoneId };
}

// ─── Get with splits ────────────────────────────────────────────────────────

export async function getExpenseWithSplits(expenseId: string) {
    const expense = await getExpense(expenseId);
    if (!expense) return null;

    const splitList = await db
        .select()
        .from(splits)
        .where(eq(splits.expenseId, expenseId));

    return { ...expense, splits: splitList };
}

// ─── Get revisions ──────────────────────────────────────────────────────────

export async function getRevisions(expenseId: string) {
    return db
        .select()
        .from(expenseRevisions)
        .where(eq(expenseRevisions.expenseId, expenseId))
        .orderBy(desc(expenseRevisions.version));
}
