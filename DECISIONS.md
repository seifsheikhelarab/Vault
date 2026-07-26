# Architecture Decisions

All resolved decisions from the design session. Read this before building anything.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + TanStack Router/Query/Table/Form, Recharts, Tailwind | Portfolio piece — get reps with TanStack ecosystem |
| Backend | Hono | Web Standards, ultrafast, TypeScript-first, lightweight |
| Database | PostgreSQL + Drizzle ORM | Type-safe schema, migrations, relational + SQL query APIs |
| Auth | BetterAuth | Self-hosted, open source, email/password + OAuth plugins |
| File Storage | Cloudinary | Receipt uploads |
| Monorepo | pnpm workspaces | Shared types between frontend/backend, one install, one dev command |

## Domain Model

See `CONTEXT.md` for full glossary. Key decisions:

- **Expense** is the unified entity. `scope` tag (personal/group/company). Split and Claim are extensions, not fields.
- **Group** unified with Department. Single entity, `kind` field (`social` or `department`).
- **Derived balances** — computed from Expenses + Settlements, never materialized. Cached via TanStack Query.
- **Net bidirectional debt** — single direction per pair, not separate records.
- **Per-Group roles** — Membership carries `admin`/`member` role per Group.
- **Global categories** — default set + user-level customization. Groups inherit from creator.
- **Unified Budget model** — `{ group_id, category_id, amount, period }`. `group_id` null = personal.
- **Claim state machine** — `submitted → approved → reimbursed` (manual), `submitted → rejected` (terminal).
- **Ownership rules** — Creator only edits/deletes personal/group expenses. Department admins manage employee claims.

## Backend Architecture

### Route Structure

```
server/src/
├── index.ts                  # Hono app + global middleware
├── resources/
│   ├── expenses/
│   │   ├── expense.router.ts
│   │   ├── expense.controller.ts
│   │   ├── expense.service.ts
│   │   └── expense.schema.ts
│   ├── groups/
│   │   ├── group.router.ts
│   │   ├── group.controller.ts
│   │   ├── group.service.ts
│   │   └── group.schema.ts
│   ├── settlements/
│   │   ├── settlement.router.ts
│   │   ├── settlement.controller.ts
│   │   ├── settlement.service.ts
│   │   └── settlement.schema.ts
│   ├── categories/
│   │   ├── category.router.ts
│   │   ├── category.controller.ts
│   │   ├── category.service.ts
│   │   └── category.schema.ts
│   ├── budgets/
│   │   ├── budget.router.ts
│   │   ├── budget.controller.ts
│   │   ├── budget.service.ts
│   │   └── budget.schema.ts
│   └── claims/
│       ├── claim.router.ts
│       ├── claim.controller.ts
│       ├── claim.service.ts
│       └── claim.schema.ts
├── lib/
│   ├── auth.ts               # BetterAuth config
│   ├── db.ts                 # Drizzle client
│   ├── middleware.ts          # auth guard, rate limiter, logger
│   ├── response.ts           # normalized response helpers
│   └── validators.ts         # shared Zod validation middleware
├── tests/
│   ├── expenses.test.ts
│   └── helpers.ts
```

### File Responsibilities

| File | Does | Doesn't |
|------|------|---------|
| `*.schema.ts` | Zod schemas for request bodies, params, query | Business logic |
| `*.router.ts` | Route definitions, middleware, calls controller | Direct DB access |
| `*.controller.ts` | Validates input (Zod), calls service, returns `ok()`/`fail()` | Business rules |
| `*.service.ts` | Business logic, Drizzle queries, balance computation | HTTP concerns |

### Response Format

All responses normalized:

```ts
// Success
{ success: true, data: T }

// Failure
{ success: false, error: { code: string, message: string } }
```

Helpers in `lib/response.ts`: `ok(data)` and `fail(code, message)`.

### Middleware Stack (order matters)

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `logger()` | Request/response logging |
| 2 | `cors()` | Cross-origin (dev: localhost:5173, prod: configured domain) |
| 3 | `csrf()` | Form submission protection |
| 4 | `rateLimiter()` | 100 req/min per IP on `/api/*` |
| 5 | `authMiddleware` | BetterAuth session check on `/api/*` |
| 6 | Route-level Zod validation | Request body/params validation |
| 7 | `cache()` | On read-heavy GETs (categories, budgets) |

### Validation

Zod schemas in each `*.schema.ts`. Applied via middleware in router files. Shared between route and test.

### Testing

- **Vitest** as test runner
- **Hono test client** (`hc`) for type-safe API calls
- **BetterAuth test helpers** for creating test users/sessions
- Test DB with isolated schema per test suite

### Auth (BetterAuth)

- Email/password + organization plugin
- Organization plugin handles: company/group creation, member management, invitations, roles
- Session carries `organizationId` — used in route guards
- Routes protected via `authMiddleware` on `/api/*`

### Caching

Hono `cache` middleware on read-heavy endpoints (categories, budgets). TTL-based.

## Frontend Architecture

### Routes (TanStack Router file-based)

- `/` — Dashboard (context-aware: personal by default, switchable to group/company)
- `/expenses` — Full expense list/table with filters
- `/expenses/new` — Add expense
- `/groups` — List of groups
- `/groups/:id` — Group detail, balances, expense list, settle up
- `/company` — Department overview, budget vs actual
- `/company/claims` — Claims queue (admin) or my claims (employee)
- `/settings` — Categories, budgets, dark mode toggle

### Key Patterns

- Search params for filter state (lives in URL, not component state)
- TanStack Query for all data fetching and mutations
- Optimistic updates for settling debts, approving claims
- TanStack Table for sortable/filterable expense lists
- TanStack Form for add/edit expense, group creation

## Project Structure

```
expense-tracker/
├── package.json              # workspace root
├── pnpm-workspace.yaml
├── server/                   # Hono backend
│   ├── package.json
│   ├── drizzle.config.ts
│   └── src/
├── app/                      # React frontend
│   ├── package.json
│   └── src/
├── packages/
│   └── shared/               # shared types (Expense, Group, etc.)
│       ├── package.json
│       └── src/
├── CONTEXT.md                # domain glossary
├── DECISIONS.md              # this file
├── prd.md                    # product requirements
└── docs/adr/                 # architecture decision records
```

## Phases

1. **MVP**: Personal tracking — expenses, charts, budgets, auth
2. **Groups**: Splits, derived balances, settle up
3. **Company**: Departments (Group kind=department), claims, approval workflow
4. **Polish**: Dark mode, drag-and-drop receipts, micro-interactions, loading/empty states
