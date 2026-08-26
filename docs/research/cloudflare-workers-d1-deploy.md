# Deploying Vault to Cloudflare Workers + D1

Research date: 2026-08-25. Facts pulled from live primary-source docs (developers.cloudflare.com, prisma.io, better-auth.com); doc-page "Last updated" dates noted where shown. Compiled from a background research pass against primary sources only.

## 1. Authenticate and deploy a Worker

**Auth paths** (both current):

- Interactive: `npx wrangler login` — OAuth browser flow; stores token in plaintext TOML (`~/.config/.wrangler/config/default.toml`) unless `--use-keyring`; supports `--device` for headless (no localhost callback) and `--scopes`/`--scopes-list` (https://developers.cloudflare.com/workers/wrangler/commands/general/, updated 2026-08-19)
- Non-interactive/CI: set `CLOUDFLARE_API_TOKEN` (+ optionally `CLOUDFLARE_ACCOUNT_ID`) env vars; they take priority over stored OAuth credentials. Create token in dashboard under Account API Tokens → Custom → **Edit Cloudflare Workers** permission, scope to one account (https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- Verify: `npx wrangler whoami` (https://developers.cloudflare.com/workers/wrangler/commands/general/)

**Deploy**: `npx wrangler deploy [--minify]`. Reads `wrangler.jsonc` from project dir. Useful flags: `--dry-run`, `--outdir`, `--secrets-file <file>` (upload secrets alongside code, JSON or .env), `--keep-vars`, `--env <name>` (https://developers.cloudflare.com/workers/wrangler/commands/workers/, updated 2026-08-13). Verify by hitting the printed `*.workers.dev` URL; inspect with `npx wrangler deployments list`, `npx wrangler tail`.

**account_id**: optional in config. Config reference lists `account_id` as an optional inheritable key; can also come from `CLOUDFLARE_ACCOUNT_ID` env var (https://developers.cloudflare.com/workers/wrangler/configuration/#inheritable-keys). Required only when the account is ambiguous (multiple accounts / CI).

## 2. D1: create, bind, migrate

**Create** (https://developers.cloudflare.com/d1/get-started/, updated 2026-04-21):

```
npx wrangler d1 create vault-db --location weur   # location optional hint
```

Output gives a ready-to-paste binding block. Wrangler prompts "Would you like Wrangler to add it on your behalf?" and can write the binding into your config automatically (`--update-config` flag exists on `d1 create`: https://developers.cloudflare.com/d1/wrangler-commands/, updated 2026-04-21). Other commands: `d1 list`, `d1 info`, `d1 execute`, `d1 delete`.

**Binding schema** — exact current keys (https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases, updated 2026-08-13):

```jsonc
{
    "d1_databases": [
        {
            "binding": "DB", // required, valid JS variable name
            "database_name": "vault-db", // required
            "database_id": "<UUID>", // required, from d1 create/list
            "preview_database_id": "<UUID>", // optional; used by wrangler dev --remote so you don't hit prod
            "migrations_dir": "migrations", // optional; default "migrations"
            "migrations_table": "d1_migrations", // optional custom table name
            "migrations_pattern": "<glob>", // optional; nested layouts e.g. Drizzle's migrations/*/migration.sql; requires migrations_dir, must start with it
        },
    ],
}
```

There is no per-binding `remote` boolean in the standard config; remote-vs-local is selected per command with `--remote`/`--local` flags. A `"remote": true` key does exist as a _remote-binding_ opt-in for `wrangler dev` sessions (https://developers.cloudflare.com/d1/best-practices/local-development/, updated 2026-06-25) — that is a dev-session feature, not a deploy setting. Automatic provisioning beta lets you omit `database_id`; Wrangler creates + writes back the ID on deploy (https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning).

**Migrations** (https://developers.cloudflare.com/d1/reference/migrations/, updated 2026-06-08):

```
npx wrangler d1 migrations create vault-db init           # creates migrations/0000_init.sql (empty)
npx wrangler d1 migrations list vault-db --local|--remote # unapplied list
npx wrangler d1 migrations apply vault-db --local         # local dev DB
npx wrangler d1 migrations apply vault-db --remote        # production DB
```

Applied migrations tracked in `d1_migrations` table inside the DB. Failed migration rolls back that migration. Ad-hoc SQL: `npx wrangler d1 execute vault-db --local|--remote --file=./schema.sql`. Prefer passing the database name, not binding name, since binding names change (warning on the migrations page).

**Local dev**: `wrangler dev` runs workerd+Miniflare locally; D1 binding resolves to a local SQLite file persisted across runs under `.wrangler/state/v3/d1` (`--persist-to` to relocate). Local session has zero access to prod data by default.

## 3. Prisma 7 ↔ D1

**Supported, but Preview.** `@prisma/adapter-d1` exists at v7.x for Prisma 7 — npm latest is 7.9.1, ships a `workerd` export condition (`dist/index-workerd.mjs`) (https://registry.npmjs.org/@prisma/adapter-d1/latest, fetched 2026-08-25). Prisma's own README still labels it Preview pending GA (https://github.com/prisma/prisma/blob/main/packages/adapter-d1/README.md). Cloudflare maintains a first-party tutorial (https://developers.cloudflare.com/d1/tutorials/d1-and-prisma-orm/, updated 2026-08-10).

Setup shape (https://www.prisma.io/docs/orm/latest/overview/databases/cloudflare-d1):

- schema uses `provider = "sqlite"` + driver adapter `PrismaD1(env.DB)`; generator `provider = "prisma-client"`, `runtime = "cloudflare"`
- **Migrations**: `prisma migrate dev`/`db push` do NOT work against D1. Official workflow = `wrangler d1 migrations create` for the file + `prisma migrate diff --from-empty|--from-local-d1 --to-schema ./prisma/schema.prisma --script --output migrations/XXXX.sql` to fill it + `wrangler d1 migrations apply --local/--remote`. (`prisma migrate diff --from-local-d1` reads the local Miniflare SQLite file.)

**Known caveats** (same Prisma page):

- **Transactions not supported.** D1 has no interactive transactions (open workers-sdk issue #2733); Prisma's D1 adapter silently runs implicit/explicit transactions as individual queries — ACID guarantees broken.
- Adapter status Preview, feedback via GitHub discussion prisma/prisma#23646.

**Officially documented query layers for D1** (if dropping Prisma):

- Raw D1 Workers Binding API (`env.DB.prepare().bind().run()`, `.batch()`) — the native path (https://developers.cloudflare.com/d1/worker-api/)
- Drizzle ORM — fully supported, `drizzle(env.DB)` from `drizzle-orm/d1`, drizzle-kit migrations wired via `migrations_dir`/`migrations_pattern` (https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1; Cloudflare's migrations page names Drizzle as the nested-layout example)
- Kysely — used internally by Better Auth's built-in adapter for SQLite/D1 (https://better-auth.com/docs/adapters/sqlite)

Cloudflare keeps a community-projects list of ORMs/query builders (https://developers.cloudflare.com/d1/reference/community-projects/).

## 4. Better Auth on D1/SQLite

Yes, first-party supported. Primary source: https://better-auth.com/docs/concepts/database:

- Built-in Kysely adapter accepts SQLite/D1 directly — the doc's own Cloudflare D1 example passes the raw binding:
    ```ts
    import { env } from 'cloudflare:workers';
    export const auth = betterAuth({ database: env.DB /* D1Database */, ... });
    ```
- SQLite drivers listed for Node contexts: better-sqlite3 (recommended), `node:sqlite` DatabaseSync (RC), `bun:sqlite` (https://better-auth.com/docs/adapters/sqlite). None run inside Workers — inside a Worker use the D1 binding path above.
- Drizzle adapter with `provider: "sqlite"` over `drizzle(env.DB)` is the documented alternative.
- **Documented gotchas:**
    - The auth CLI cannot reach a remote D1 ("Cloudflare D1 can only be queried through a Cloudflare Worker, so the CLI cannot access it directly"). Migration options: programmatic `getMigrations()` from `better-auth/db/migration` exposed on a protected endpoint (their Hono example matches this repo's stack), or CLI `generate` + apply SQL yourself. Caveat: `getMigrations` works **only** with the built-in Kysely adapter — not Drizzle/Prisma adapters.
    - `env` access at module top-level requires importing from `cloudflare:workers`.
    - Sessions/rate-limit counters can be offloaded to KV via `secondaryStorage` (documented interface) — relevant if session reads should bypass the single-threaded D1 primary.

No version-pinned gotchas specific to 1.7 surfaced in the official docs.

## 5. Secrets & env vars

- **Local dev**: `.dev.vars` (dotenv syntax) next to wrangler.jsonc; gitignore it. `.dev.vars.<env>` overrides entirely per environment. New alternative: `.env` files (choose ONE of `.dev.vars` or `.env` — if `.dev.vars` exists, `.env` is ignored). `secrets.required` config property validates which keys must exist (https://developers.cloudflare.com/workers/configuration/secrets/, updated 2026-07-03)
- **Production secrets**: `npx wrangler secret put KEY` (prompts or pipe stdin; creates + deploys a new version immediately), `wrangler secret list`, `wrangler secret bulk [FILE]` (JSON or .env; up to 100; JSON `null` deletes), `wrangler secret delete KEY`, and `wrangler deploy --secrets-file .env.production` (https://developers.cloudflare.com/workers/wrangler/commands/workers/; https://developers.cloudflare.com/workers/configuration/secrets/)
- **Plaintext vars**: `vars` object in wrangler.jsonc — never for sensitive values; dashboard-set vars get overwritten on next `wrangler deploy` unless `keep_vars: true`
- **Typegen**: `npx wrangler types` regenerates worker-configuration types matched to bindings + compatibility_date; rerun after every binding change; `--check` flag for CI drift detection. This repo's `cf-typegen` script maps to this (https://developers.cloudflare.com/workers/languages/typescript/, updated 2026-07-03)

## 6. Hyperdrive

- Create: `npx wrangler hyperdrive create <NAME> --connection-string="postgres://user:pass@host:5432/db"` — verifies credentials live; prints `{ "hyperdrive": [{ "binding": "...", "id": "<id>" }] }`; swap that `id` into the binding in wrangler.jsonc. Optional `--caching-disabled`, `--max-age` (https://developers.cloudflare.com/hyperdrive/get-started/, updated 2026-07-05)
- Binding keys: `binding` + `id`; optional `localConnectionString` for `wrangler dev` against your real DB (or env var `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>`); caching inactive locally (same page)
- **Paid-plan requirement: NO LONGER TRUE.** Current pricing: "Hyperdrive is included in both the Free and Paid Workers plans" — Free gets 100,000 database queries/day, resets 00:00 UTC (https://developers.cloudflare.com/hyperdrive/platform/pricing/, updated 2026-06-18; mirrored at https://developers.cloudflare.com/workers/platform/pricing/#hyperdrive)
- Driver note: `pg` 8.13.0+ recommended; example code instantiates a fresh `pg.Client` per request from `env.HYPERDRIVE.connectionString`

## 7. Cron triggers

- Config shape confirmed current: top-level `"triggers": { "crons": ["0 3 * * *"] }`. `crons: []` removes all; omitting the key leaves existing triggers untouched (https://developers.cloudflare.com/workers/configuration/cron-triggers/, updated 2026-06-20)
- Worker must export a `scheduled(controller, env, ctx)` handler — required. Test locally via `/cdn-cgi/handler/scheduled` route (or `/__scheduled?cron=...` per wrangler dev `--test-scheduled`)
- Propagation up to 15 minutes. UTC only. Wall time cap 15 min/invocation; CPU per cron invocation: 10 ms Free / 30 s–15 min Paid (https://developers.cloudflare.com/workers/platform/limits/)
- **Free plan: available.** Account limit 5 cron triggers (Free) vs 250 (Paid)

## 8. Ratelimits binding ("simple")

- Status: **GA since 2025-09-19** — "The `ratelimit` binding is now stable and recommended for all production workloads" (https://developers.cloudflare.com/changelog/post/2025-09-19-ratelimit-workers-ga/)
- Current config shape — top-level `ratelimits` array, requires Wrangler ≥ 4.36.0 (repo has 4.110) (https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/, updated 2026-04-23):
    ```jsonc
    "ratelimits": [
        {
            "name": "MY_RATE_LIMITER",
            "namespace_id": "1001", // string containing positive integer, unique per account
            "simple": { "limit": 100, "period": 60 }, // period MUST be 10 or 60 seconds; simple is the only type
        },
    ]
    ```
- Runtime: `const { success } = await env.MY_RATE_LIMITER.limit({ key })`. Counters are per-Cloudflare-location (per-PoP), eventually consistent, near-zero latency; same `namespace_id` across Workers shares counters intentionally.
- **Plan availability: UNVERIFIED.** Neither the rate-limiting page nor the GA changelog states a plan requirement; no pricing line item exists on the Workers pricing page. No documented paywall — verify empirically on your plan.

## 9. D1 practical limits before committing

(https://developers.cloudflare.com/d1/platform/limits/, updated 2026-04-21; pricing https://developers.cloudflare.com/workers/platform/pricing/#d1)

| Limit                                | Free      | Paid                         |
| ------------------------------------ | --------- | ---------------------------- |
| Max DB size                          | 500 MB    | 10 GB (hard cap)             |
| Storage per account                  | 5 GB      | 1 TB                         |
| Rows read                            | 5 M/day   | 25 B/mo incl., then $0.001/M |
| Rows written                         | 100 k/day | 50 M/mo incl., then $1.00/M  |
| Queries (subrequests) per invocation | 50        | 1000                         |
| Time Travel PITR window              | 7 days    | 30 days                      |
| Databases per account                | 10        | 50,000                       |

Absolute caps either plan: 100 KB max SQL statement length, 2 MB max row/BLOB, 100 bound parameters, 100 columns/table, 30 s max query duration, ≤6 simultaneous open connections per invocation.

Session-heavy workload guidance, straight from the limits FAQ:

- Each D1 database is **single-threaded** (backed by one Durable Object): throughput ≈ 1/(avg query duration). 1 ms queries ≈ 1000 QPS; 100 ms ≈ 10 QPS. Overload → queue → "overloaded" errors.
- Writes cost several ms; indexes cut rows-read billing and latency; index writes count as an extra row written.
- Bulk updates/deletes must be batched (~1000 rows/chunk).
- Scale model is horizontal (many small per-tenant DBs), not one big DB.

Fit assessment for Vault: sizes/row counts trivially inside limits; the real concerns are **no transactions** (see §3) plus per-write latency — fine for low-volume single-user writes, architecturally weaker than Postgres for atomic multi-row money operations. Cloudflare's storage-options comparison: https://developers.cloudflare.com/workers/platform/storage-options/.

## 10. nodejs_compat

- New threshold (2026 change): compatibility_date ≥ `2026-08-04` enables `nodejs_compat` implicitly — "Built-in Node.js APIs and polyfills are available without additional configuration… Omit them from new configurations"; existing projects may leave the flag in place harmlessly (https://developers.cloudflare.com/workers/runtime-apis/nodejs/, updated 2026-08-12)
- Dates `2024-09-23` through `2026-08-03` require explicit `compatibility_flags: ["nodejs_compat"]`
- This repo sits at `2026-08-22` → Node compat is implicit; existing `nodejs_compat` flag redundant-but-harmless
- Prisma/pg on Workers needs: nodejs_compat (TCP via Node APIs) OR HTTP-based drivers; `pg` ≥ 8.13 recommended with Hyperdrive (https://www.prisma.io/docs/guides/deployment/cloudflare-workers; https://developers.cloudflare.com/hyperdrive/get-started/). Prisma generator should declare `runtime = "cloudflare"`/`"workerd"` (this repo does: prisma/schema.prisma:8)

## Recommended deploy path (chosen: A — Hyperdrive → Neon)

Option A keeps Prisma + Postgres via Hyperdrive → Neon: zero dependency churn, transactions intact. Option B (D1) documented above for reference; requires adapter swap, sqlite provider change, new migration workflow, and accepting Preview-status adapter + no ACID multi-statement writes.

A-checklist executed 2026-08-25:

1. `npx wrangler login`
2. `npx wrangler hyperdrive create vault-hyperdrive --connection-string="<neon-url>"` → swap id into wrangler.jsonc
3. `wrangler secret put BETTER_AUTH_SECRET / GEMINI_API_KEY / DATABASE_URL`; add `BETTER_AUTH_URL` plain var
4. `npm run cf-typegen && npm run lint && npm test`
5. `npm run deploy` → verify URL + `npx wrangler tail`
6. `DATABASE_URL=<neon-url> npx prisma migrate deploy`
