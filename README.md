# Vault

A personal expense tracker backend built with **Hono** on **Cloudflare Workers**, backed by **PostgreSQL** via Prisma, with **Gemini AI** for chat-based expense entry.

## Features

- **Expense tracking** — CRUD with keyset pagination, soft-delete tombstones, and category organization
- **Budgets** — Weekly or monthly spending limits per category or across all spending, with spent-vs-limit progress
- **Recurring purchases** — Define subscriptions and recurring expenses; a daily cron materializes due occurrences with catch-up
- **Chat expense entry** — Talk to a Gemini-powered parser that extracts amount, category, and date from natural language
- **Reports** — Weekly and monthly aggregates with timezone-aware period boundaries and spending deltas
- **Dashboard** — Home-screen snapshot combining totals, recent expenses, and budget progress
- **Offline-first sync** — LWW batch push + incremental pull-by-cursor for the Flutter mobile client
- **Email/password auth** — Better Auth with session tokens, bearer support for native clients, and automatic default category seeding

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (workerd) |
| HTTP Framework | Hono |
| Database | PostgreSQL (Neon hosted, Hyperdrive in production) |
| ORM | Prisma (PG adapter, workerd runtime) |
| Auth | Better Auth (email/password + bearer plugin) |
| AI | Google Generative AI (Gemini 2.5 Flash) |
| Validation | Zod v4 |
| Testing | Vitest |
| Linting / Formatting | oxlint + oxfmt |
| Package Manager | Bun |

## Project Structure

```
src/
├── api/                        # Resource routers
│   ├── auth/                   # Better Auth passthrough (signup, signin, session)
│   ├── budgets/                # CRUD + progress with tz-aware periods
│   ├── categories/             # CRUD (seeded per user on signup)
│   ├── chat/                   # Gemini-powered expense parsing
│   ├── dashboard/              # Home-screen snapshot endpoint
│   ├── expenses/               # CRUD + keyset pagination + soft-delete
│   ├── recurring/              # CRUD + pause/resume (cron materializes)
│   ├── reports/                # Weekly/monthly aggregates with deltas
│   ├── sync/                   # LWW push + cursor-based pull
│   └── index.ts                # Aggregates all routers, injects request-scoped Prisma
├── config/
│   ├── auth.ts                 # Better Auth factory + requireAuth guard
│   ├── env.ts                  # AppBindings / AppEnv types
│   ├── errors.ts               # Central error handler (Zod → envelope)
│   ├── prisma.ts               # Prisma client factory (one per connection string)
│   └── rate-limit.ts           # Edge rate-limiting with in-memory fallback
├── generated/                  # Prisma client output (workerd runtime)
├── test/                       # Test harness, fixtures, global setup
├── utils/
│   ├── ownership.ts            # Shared ownership/serialization helpers
│   └── period.ts               # Timezone-aware period boundary math
└── index.ts                    # Workers entry: fetch + scheduled cron

prisma/
└── schema.prisma               # Database schema (PostgreSQL)
scripts/
└── seed.ts                     # Database seeding script
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (package manager)
- [Node.js](https://nodejs.org/) (for Wrangler and tooling)
- A PostgreSQL database (local or Neon)

### Installation

```bash
bun install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Required variables in `.dev.vars`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Long random string for session signing |
| `BETTER_AUTH_URL` | Auth base URL (default `http://localhost:8787`) |
| `GEMINI_API_KEY` | Google Generative AI API key (for chat parsing) |

### Generate Prisma Client

```bash
bunx prisma generate
```

### Run Locally

```bash
bun run dev
```

The dev server starts on `http://localhost:8787` via Wrangler.

## Available Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start local dev server |
| `bun run deploy` | Deploy to Cloudflare Workers (minified) |
| `bun run cf-typegen` | Regenerate `CloudflareBindings` type from wrangler config |
| `bun run generate` | Regenerate Prisma client |
| `bun run seed` | Seed the database |
| `bun run lint` | Run oxlint |
| `bun run format` | Format with oxfmt |
| `bun run format:check` | Check formatting without writing |

## API Reference

All endpoints (except auth) require authentication via session cookie or `Authorization: Bearer <token>`.

### Auth (`/api/auth/*`)

Handled by Better Auth. Sign up with email/password; sessions are stored in Postgres. Native clients receive tokens via the `set-auth-token` response header.

### Expenses (`/api/expenses`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/expenses` | Create an expense |
| `GET` | `/api/expenses` | List expenses (keyset pagination) |
| `GET` | `/api/expenses/:id` | Get a single expense |
| `PATCH` | `/api/expenses/:id` | Update an expense |
| `DELETE` | `/api/expenses/:id` | Soft-delete an expense (tombstone) |

### Categories (`/api/categories`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/categories` | Create a category |
| `GET` | `/api/categories` | List all categories |
| `GET` | `/api/categories/:id` | Get a single category |
| `PATCH` | `/api/categories/:id` | Update a category |
| `DELETE` | `/api/categories/:id` | Delete a category |

Default categories are auto-seeded on user signup.

### Budgets (`/api/budgets`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/budgets` | Create a budget (weekly or monthly, optional category) |
| `GET` | `/api/budgets` | List all budgets |
| `GET` | `/api/budgets/progress` | Get spent-vs-limit progress for the current period |
| `GET` | `/api/budgets/:id` | Get a single budget |
| `PATCH` | `/api/budgets/:id` | Update a budget |
| `DELETE` | `/api/budgets/:id` | Delete a budget |

### Recurring (`/api/recurring`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/recurring` | Create a recurring definition |
| `GET` | `/api/recurring` | List all recurring definitions |
| `GET` | `/api/recurring/:id` | Get a single definition |
| `PATCH` | `/api/recurring/:id` | Update or pause/resume a definition |
| `DELETE` | `/api/recurring/:id` | Delete a definition |

Materialization runs daily via the Workers cron trigger (catch-up for missed days, skips tombstoned occurrences).

### Chat (`/api/chat`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/parse` | Parse a natural-language message into an expense draft |

The server never saves an expense from chat — it returns a draft for the client to confirm.

### Reports (`/api/reports`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/weekly` | Weekly spending report (tz-aware, ISO 8601 weeks) |
| `GET` | `/api/reports/monthly` | Monthly spending report |

### Dashboard (`/api/dashboard`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Home-screen snapshot (totals, recent, budget progress) |

### Sync (`/api/sync`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sync/push` | LWW batch push (expenses, budgets, categories) |
| `GET` | `/api/sync/pull` | Incremental pull by cursor (new/updated/deleted records) |

## Rate Limiting

Two tiers enforced at the Cloudflare edge (in-memory fallback in local dev):

| Tier | Limit | Applied To |
|---|---|---|
| **Strict** | 10 req/min | `/api/auth/*`, `/api/chat/*` |
| **General** | 120 req/min | All `/api/*` routes |

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) are included in responses.

## Error Handling

All errors return a consistent JSON envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "issues": {
      "formErrors": [],
      "fieldErrors": { "amountMinor": ["Expected number, received nan"] }
    }
  }
}
```

Error codes: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `CONFLICT` (409), `VALIDATION_ERROR` (422), `UPSTREAM_ERROR` (502), `RATE_LIMITED` (429), `INTERNAL` (500).

## Testing

```bash
bun run test       # if wired, or
npx vitest
```

Tests run against a real PostgreSQL database with full truncation between test files. The only mock allowed is the Gemini AI parser (injected via binding). The test harness is in `src/test/helpers.ts`.

### Test Conventions

- **Behavior-only assertions** — HTTP in, status/body/DB state out; no unit-mocking of services
- **Clock seam** — time-dependent services accept an explicit `now: Date`; tests pin it deterministically
- **No fake timers** — DB-backed tests use real time with fixed inputs
- **File-serial execution** — tests run one file at a time to avoid truncate interference

## Database Schema

Key models:

- **User** — email/password auth, timezone preference (default `Africa/Cairo`)
- **Expense** — amount in minor units (piasters), optional category, soft-delete via `deletedAt`, unique constraint for recurring occurrences
- **Budget** — weekly or monthly, optional category scope
- **RecurringDefinition** — frequency (daily/weekly/monthly), interval, anchor date, pause/resume, next run tracking
- **Category** — unique per user, seeded defaults on signup

All timestamps use `timestamptz(3)` for timezone-safe storage.

## Deployment

```bash
bun run deploy
```

Requires Cloudflare Workers auth (`wrangler login`) and secrets configured via `wrangler secret put`:

```bash
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GEMINI_API_KEY
```

Production uses **Hyperdrive** for connection pooling to the hosted Postgres (Neon). The cron trigger runs daily at 03:00 UTC to materialize recurring expenses.

## License

Private — not yet licensed for public use.
