# AGENTS.md

## What this is

Backend for **Vault**, a personal expense tracker (Hono on Cloudflare Workers). Currently a fresh scaffold — `src/index.ts` is hello-world. `start.md` is the authoritative spec for the intended build-out; read it first. Where start.md conflicts with the facts below, trust this file and the actual config.

## Commands

- `npm run dev` — wrangler dev server
- `npm run deploy` — deploy to Cloudflare (`--minify`)
- `npm run cf-typegen` — regenerate the `CloudflareBindings` type; rerun after any `wrangler.jsonc` binding change
- Install deps with **bun** (`bun add`) — `bun.lock` is the only lockfile; npm/yarn installs leave it stale
- Lint/format: oxlint + oxfmt (per spec, not yet wired up)

## Runtime gotchas

- Target is Cloudflare Workers, not Node: no dotenv / `listen()` entrypoint. Env reaches handlers via bindings typed as `CloudflareBindings`; instantiate Hono as `new Hono<{ Bindings: CloudflareBindings }>()`. The "imports dotenv, calls startServer()" sketch in start.md does not apply to this runtime.
- Local secrets/env go in `.dev.vars` (gitignored), read via `c.env` in dev.
- `nodejs_compat` flag is commented out in `wrangler.jsonc`; enable it if Prisma or its driver needs Node APIs.
- tsconfig uses `jsxImportSource: hono/jsx`.

## Stack plan

- Prisma + PostgreSQL: local dev user `postgres` / password `admin`; hosted on Neon.
- Better Auth (email/password). Google Generative AI (Gemini) for chat expense entry.
- Tests: Vitest + Better Auth testing module + Hono test helpers.

## Intended layout (from start.md; not built yet)

- `src/api/<resource>/` — router, controller, service, validation, test per resource; `api/index.ts` aggregates routers.
- `src/config/` — env, prisma client, rate limit, auth. `src/utils/`, `src/test/`.
- `prisma/schema.prisma`.

## Rules (from start.md)

- No `any`, no hacks/workarounds.
- Everything tested — features ship with tests.
- Ask when unsure.

## Agent skills

### Issue tracker

GitHub Issues on seifsheikhelarab/Vault via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label strings equal to role names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
