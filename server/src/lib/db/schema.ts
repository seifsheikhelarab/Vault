import { relations } from 'drizzle-orm';
import {
    numeric,
    pgTable,
    text,
    timestamp,
    varchar
} from 'drizzle-orm/pg-core';
import {
    user,
    session,
    account,
    invitation,
    member
} from './auth-schema';

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

// ─── Expenses ────────────────────────────────────────────────────────────
export const expenses = pgTable('expense', {
    id: text('id').primaryKey(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
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
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Splits ──────────────────────────────────────────────────────────────
export const splits = pgTable('split', {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
        .notNull()
        .references(() => expenses.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Groups ──────────────────────────────────────────────────────────────
export const groups = pgTable('group', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: varchar('kind', { length: 20 }).notNull().default('social'),
    createdBy: text('created_by')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Memberships ─────────────────────────────────────────────────────────
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

// ─── Settlements ─────────────────────────────────────────────────────────
export const settlements = pgTable('settlement', {
    id: text('id').primaryKey(),
    fromUserId: text('from_user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    toUserId: text('to_user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    groupId: text('group_id').references(() => groups.id, {
        onDelete: 'set null'
    }),
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Categories ──────────────────────────────────────────────────────────
export const categories = pgTable('category', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    icon: text('icon'),
    userId: text('user_id').references(() => user.id, {
        onDelete: 'cascade'
    }),
    createdAt: timestamp('created_at').notNull().defaultNow()
});

// ─── Budgets ─────────────────────────────────────────────────────────────
export const budgets = pgTable('budget', {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
        .notNull()
        .references(() => categories.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    period: varchar('period', { length: 20 }).notNull().default('monthly'),
    userId: text('user_id').references(() => user.id, {
        onDelete: 'cascade'
    }),
    groupId: text('group_id').references(() => groups.id, {
        onDelete: 'cascade'
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .$onUpdate(() => new Date())
});

// ─── Claims ──────────────────────────────────────────────────────────────
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

// ─── Relations (drizzle-orm 0.45 per-table API) ─────────────────────────
export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    members: many(member),
    invitations: many(invitation),
    expenses: many(expenses),
    splits: many(splits),
    memberships: many(memberships),
    categories: many(categories),
    budgets: many(budgets)
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
    user: one(user, { fields: [expenses.userId], references: [user.id] }),
    group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
    category: one(categories, {
        fields: [expenses.categoryId],
        references: [categories.id]
    }),
    splits: many(splits)
}));

export const splitsRelations = relations(splits, ({ one }) => ({
    expense: one(expenses, {
        fields: [splits.expenseId],
        references: [expenses.id]
    }),
    user: one(user, { fields: [splits.userId], references: [user.id] })
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
    members: many(memberships),
    expenses: many(expenses),
    settlements: many(settlements),
    budgets: many(budgets),
    creator: one(user, { fields: [groups.createdBy], references: [user.id] })
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
    group: one(groups, {
        fields: [memberships.groupId],
        references: [groups.id]
    }),
    user: one(user, { fields: [memberships.userId], references: [user.id] })
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
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
    })
}));

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
