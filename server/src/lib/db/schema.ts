import { relations } from 'drizzle-orm';
import {
    bigint,
    boolean,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    varchar
} from 'drizzle-orm/pg-core';
import { user, session, account, invitation, member } from './auth-schema';

// Re-export auth-schema tables so everything imports from one place
export {
    user,
    session,
    account,
    verification,
    organization,
    member,
    invitation
} from './auth-schema';
export {
    sessionRelations,
    accountRelations,
    organizationRelations,
    memberRelations,
    invitationRelations
} from './auth-schema';

// ─── Money constraint ──────────────────────────────────────────────────────
// Business maximum: $1,000,000 = 100,000,000 cents (well below MAX_SAFE_INTEGER
// and bigint range). Every positive monetary value is checked at the API
// boundary. Signed adjustments are bounded to ±100,000,000 cents.

// ─── Expenses (immutable root) ─────────────────────────────────────────────

export const expenses = pgTable('expense', {
    id: text('id').primaryKey(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    description: text('description').notNull(),
    date: timestamp('date').notNull(),
    receiptUrl: text('receipt_url'),
    scope: varchar('scope', { length: 20 }).notNull().default('personal'),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, {
        onDelete: 'set null'
    }),
    categoryId: text('category_id')
        .notNull()
        .references(() => categories.id, { onDelete: 'restrict' }),
    // Immutable identity snapshots of the payer at time of creation
    payerNameSnapshot: text('payer_name_snapshot').notNull(),
    payerEmailSnapshot: text('payer_email_snapshot').notNull(),
    // Points to the current (latest) revision; null until first revision
    currentRevisionId: text('current_revision_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Expense Revisions (append-only) ───────────────────────────────────────

export const expenseRevisions = pgTable('expense_revision', {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
        .notNull()
        .references(() => expenses.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    description: text('description').notNull(),
    categoryId: text('category_id')
        .notNull()
        .references(() => categories.id, { onDelete: 'restrict' }),
    authorId: text('author_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    authorNameSnapshot: text('author_name_snapshot').notNull(),
    authorEmailSnapshot: text('author_email_snapshot').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Expense Tombstones (append-only deletion records) ─────────────────────

export const expenseTombstones = pgTable('expense_tombstone', {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
        .notNull()
        .references(() => expenses.id, { onDelete: 'cascade' })
        .unique(),
    authorId: text('author_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    authorNameSnapshot: text('author_name_snapshot').notNull(),
    authorEmailSnapshot: text('author_email_snapshot').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Splits (per-expense participant allocations) ──────────────────────────

export const splits = pgTable('split', {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
        .notNull()
        .references(() => expenses.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    // Immutable identity snapshots
    userNameSnapshot: text('user_name_snapshot').notNull(),
    userEmailSnapshot: text('user_email_snapshot').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Adjustments (signed corrections to expenses) ──────────────────────────

export const adjustments = pgTable('adjustment', {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
        .notNull()
        .references(() => expenses.id, { onDelete: 'cascade' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    // Pending adjustments have no financial effect
    requesterId: text('requester_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    requesterNameSnapshot: text('requester_name_snapshot').notNull(),
    requesterEmailSnapshot: text('requester_email_snapshot').notNull(),
    reviewerId: text('reviewer_id').references(() => user.id, {
        onDelete: 'set null'
    }),
    reviewerNameSnapshot: text('reviewer_name_snapshot'),
    reviewerEmailSnapshot: text('reviewer_email_snapshot'),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Adjustment Allocations (per-participant deltas) ───────────────────────

export const adjustmentAllocations = pgTable('adjustment_allocation', {
    id: text('id').primaryKey(),
    adjustmentId: text('adjustment_id')
        .notNull()
        .references(() => adjustments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    amountCentsDelta: bigint('amount_cents_delta', {
        mode: 'number'
    }).notNull(),
    userNameSnapshot: text('user_name_snapshot').notNull(),
    userEmailSnapshot: text('user_email_snapshot').notNull()
});

// ─── Groups ─────────────────────────────────────────────────────────────────

export const groups = pgTable('group', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: varchar('kind', { length: 20 }).notNull().default('social'),
    organizationId: text('organization_id'),
    createdBy: text('created_by')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    closed: boolean('closed').notNull().default(false),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Memberships ────────────────────────────────────────────────────────────

export const memberships = pgTable('membership', {
    id: text('id').primaryKey(),
    groupId: text('group_id')
        .notNull()
        .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('member'),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Settlements ────────────────────────────────────────────────────────────

export const settlements = pgTable('settlement', {
    id: text('id').primaryKey(),
    fromUserId: text('from_user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    fromUserNameSnapshot: text('from_user_name_snapshot').notNull(),
    fromUserEmailSnapshot: text('from_user_email_snapshot').notNull(),
    toUserId: text('to_user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    toUserNameSnapshot: text('to_user_name_snapshot').notNull(),
    toUserEmailSnapshot: text('to_user_email_snapshot').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    groupId: text('group_id').references(() => groups.id, {
        onDelete: 'set null'
    }),
    note: text('note'),
    // Derived-debt context snapshot immediately before this settlement
    debtContextSnapshot: jsonb('debt_context_snapshot'),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Settlement Corrections (compensating, exact inverse) ───────────────────

export const settlementCorrections = pgTable('settlement_correction', {
    id: text('id').primaryKey(),
    originalSettlementId: text('original_settlement_id')
        .notNull()
        .references(() => settlements.id, { onDelete: 'cascade' }),
    // Must be the exact inverse of the original settlement's amountCents
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    requesterId: text('requester_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    requesterNameSnapshot: text('requester_name_snapshot').notNull(),
    requesterEmailSnapshot: text('requester_email_snapshot').notNull(),
    // Self-approval allowed for original payer/recipient
    approved: boolean('approved').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Categories ─────────────────────────────────────────────────────────────

export const categories = pgTable('category', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon'),
    userId: text('user_id').references(() => user.id, {
        onDelete: 'cascade'
    }),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Budgets ────────────────────────────────────────────────────────────────

export const budgets = pgTable('budget', {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
        .notNull()
        .references(() => categories.id, { onDelete: 'cascade' }),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    period: varchar('period', { length: 20 }).notNull().default('monthly'),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, {
        onDelete: 'cascade'
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Claims ─────────────────────────────────────────────────────────────────

export const claims = pgTable('claim', {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
        .notNull()
        .references(() => expenses.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('submitted'),
    reviewerId: text('reviewer_id').references(() => user.id, {
        onDelete: 'set null'
    }),
    reviewNote: text('review_note'),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Audit Events (unified immutable stream) ────────────────────────────────

export const auditEvents = pgTable('audit_event', {
    id: text('id').primaryKey(),
    actorId: text('actor_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    actorNameSnapshot: text('actor_name_snapshot').notNull(),
    actorEmailSnapshot: text('actor_email_snapshot').notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    groupId: text('group_id').references(() => groups.id, {
        onDelete: 'set null'
    }),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    beforeRef: jsonb('before_ref'),
    afterRef: jsonb('after_ref'),
    reason: text('reason'),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Relations ──────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    members: many(member),
    invitations: many(invitation),
    expenses: many(expenses),
    splits: many(splits),
    memberships: many(memberships),
    categories: many(categories),
    budgets: many(budgets),
    auditEvents: many(auditEvents)
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
    user: one(user, { fields: [expenses.userId], references: [user.id] }),
    group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
    category: one(categories, {
        fields: [expenses.categoryId],
        references: [categories.id]
    }),
    currentRevision: one(expenseRevisions, {
        fields: [expenses.currentRevisionId],
        references: [expenseRevisions.id]
    }),
    revisions: many(expenseRevisions),
    tombstone: one(expenseTombstones, {
        fields: [expenses.id],
        references: [expenseTombstones.expenseId]
    }),
    splits: many(splits),
    adjustments: many(adjustments)
}));

export const expenseRevisionsRelations = relations(
    expenseRevisions,
    ({ one }) => ({
        expense: one(expenses, {
            fields: [expenseRevisions.expenseId],
            references: [expenses.id]
        }),
        author: one(user, {
            fields: [expenseRevisions.authorId],
            references: [user.id]
        })
    })
);

export const expenseTombstonesRelations = relations(
    expenseTombstones,
    ({ one }) => ({
        expense: one(expenses, {
            fields: [expenseTombstones.expenseId],
            references: [expenses.id]
        }),
        author: one(user, {
            fields: [expenseTombstones.authorId],
            references: [user.id]
        })
    })
);

export const splitsRelations = relations(splits, ({ one }) => ({
    expense: one(expenses, {
        fields: [splits.expenseId],
        references: [expenses.id]
    }),
    user: one(user, { fields: [splits.userId], references: [user.id] })
}));

export const adjustmentsRelations = relations(adjustments, ({ one, many }) => ({
    expense: one(expenses, {
        fields: [adjustments.expenseId],
        references: [expenses.id]
    }),
    requester: one(user, {
        fields: [adjustments.requesterId],
        references: [user.id]
    }),
    reviewer: one(user, {
        fields: [adjustments.reviewerId],
        references: [user.id]
    }),
    allocations: many(adjustmentAllocations)
}));

export const adjustmentAllocationsRelations = relations(
    adjustmentAllocations,
    ({ one }) => ({
        adjustment: one(adjustments, {
            fields: [adjustmentAllocations.adjustmentId],
            references: [adjustments.id]
        }),
        user: one(user, {
            fields: [adjustmentAllocations.userId],
            references: [user.id]
        })
    })
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
    members: many(memberships),
    expenses: many(expenses),
    settlements: many(settlements),
    budgets: many(budgets),
    auditEvents: many(auditEvents),
    creator: one(user, { fields: [groups.createdBy], references: [user.id] })
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
    group: one(groups, {
        fields: [memberships.groupId],
        references: [groups.id]
    }),
    user: one(user, { fields: [memberships.userId], references: [user.id] })
}));

export const settlementsRelations = relations(settlements, ({ one, many }) => ({
    fromUser: one(user, {
        fields: [settlements.fromUserId],
        references: [user.id]
    }),
    toUser: one(user, {
        fields: [settlements.toUserId],
        references: [user.id]
    }),
    group: one(groups, {
        fields: [settlements.groupId],
        references: [groups.id]
    }),
    corrections: many(settlementCorrections)
}));

export const settlementCorrectionsRelations = relations(
    settlementCorrections,
    ({ one }) => ({
        originalSettlement: one(settlements, {
            fields: [settlementCorrections.originalSettlementId],
            references: [settlements.id]
        }),
        requester: one(user, {
            fields: [settlementCorrections.requesterId],
            references: [user.id]
        })
    })
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
    user: one(user, { fields: [categories.userId], references: [user.id] }),
    expenses: many(expenses),
    budgets: many(budgets)
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
    category: one(categories, {
        fields: [budgets.categoryId],
        references: [categories.id]
    }),
    user: one(user, { fields: [budgets.userId], references: [user.id] }),
    group: one(groups, { fields: [budgets.groupId], references: [groups.id] })
}));

export const claimsRelations = relations(claims, ({ one }) => ({
    expense: one(expenses, {
        fields: [claims.expenseId],
        references: [expenses.id]
    }),
    reviewer: one(user, { fields: [claims.reviewerId], references: [user.id] })
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
    actor: one(user, { fields: [auditEvents.actorId], references: [user.id] }),
    group: one(groups, {
        fields: [auditEvents.groupId],
        references: [groups.id]
    })
}));
