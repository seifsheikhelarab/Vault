# Expense Tracker

A web app for tracking personal, group, and company expenses.

## Language

**Expense**:
A recorded outflow of money: amount, category, date, payer, optional receipt. The core unit across all scopes. Behavior is determined by whether Splits or Claims are attached — not by a scope field.
_Avoid_: Transaction, charge, purchase (too generic), claim (use Claim for the company workflow)

**Scope**:
A tag on Expense indicating context: `personal`, `group`, or `company`. Determines which extension model applies, not the expense's identity.
_Avoid_: Type, kind

**Group**:
A named collection of users. Has a `kind` (`social` or `department`) that determines behavior — social groups use splits and balances, departments use budgets and approval. All share membership and expense routing.
_Avoid_: Department (use Group with kind=department), team

**Split**:
A share of an Expense owed by one user within a Group. One expense generates many splits. The split model depends on Group kind: social groups split by even/percentage/exact, departments don't split (company absorbs the cost).
_Avoid_: Share, allocation

**Claim**:
An expense submission in a department Group, entering an approval workflow. States: submitted → approved/rejected → reimbursed. Only exists on expenses inside department-kind Groups.
_Avoid_: Submission, request

**Settlement**:
A record that a debt between two users has been paid. Balances are always derived (computed from Expenses + Settlements), never materialized. This eliminates consistency bugs.
_Avoid_: Payment, transaction, settle-up (use Settlement for the record, "settle up" for the action)

**Membership**:
A user's relationship to a Group, carrying a role (`admin` or `member`). Roles are per-Group — a user can be admin in one group and member in another.
_Avoid_: Membership role (just use role), user role (too vague)

**Category**:
A label for classifying expenses (Food, Transport, Entertainment). Global list with user-level customization. Groups inherit from the creator's categories.
_Avoid_: Tag (too generic), type

**Budget**:
A spending limit for a Category over a time period. For personal use, applies to the user globally (group_id null). For departments, applies to a Group. Rendered as a progress bar in both cases.
_Avoid_: Cap, allowance

## Tech Stack

**Frontend**: React + TanStack Router (file-based, loaders, search params), TanStack Query (caching, optimistic updates), TanStack Table (sortable/filterable lists), TanStack Form (validation, submission), Recharts (charts), Tailwind

**Backend**: Hono (Web Standards, ultrafast, TypeScript-first)

**Database**: PostgreSQL + Drizzle ORM (type-safe schema, migrations, relational + SQL query APIs)

**Auth**: BetterAuth (self-hosted, open source, email/password + OAuth plugins)

**File Storage**: Cloudinary (receipt uploads)
