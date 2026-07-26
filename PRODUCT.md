# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary**: Recruiters and hiring managers evaluating frontend engineering skill. They scan for TanStack ecosystem fluency, component architecture, data-fetching patterns, and visual polish.

**End users** (the personas the app simulates):
- **Individual** tracking personal spending, wants to see where money goes by category and over time.
- **Group member** in a shared expense pool (trip, household, friend group), needs to see who owes who and settle up.
- **Company admin** managing a team's expenses, setting budgets, reviewing and approving employee submissions.
- **Company employee** submitting expense claims, attaching receipts, tracking approval status.

## Product Purpose

A portfolio piece that demonstrates frontend range with the TanStack stack (Router, Query, Table, Form) on a realistic, multi-scope expense tracking app. The backend is intentionally minimal so effort concentrates on UI: charts, transitions, empty states, responsive layout, optimistic updates. Success is a working app that looks professional and exercises patterns a recruiter would recognize as production-ready.

## Positioning

Not a real expense tracker competing on features. The differentiator is **visible engineering craft**: file-based routing with search-param filters, optimistic mutations, type-safe API contracts (Hono + shared types), and a polished UI that shows rather than tells. A portfolio piece that happens to track expenses, not an expense tracker that happens to be a portfolio piece.

## Operating Context

- Single developer building and iterating across 4 phases: MVP personal → groups+splits → company+claims → polish.
- Local PostgreSQL database via Drizzle ORM migrations.
- Auth via BetterAuth (self-hosted, email/password + organization plugin).
- Receipt uploads via Cloudinary.
- No real payments, no multi-currency, no mobile app.
- Deployed locally during development; responsive web is sufficient.

## Capabilities and Constraints

**Confirmed functionality:**
- Add/edit/delete expenses with amount, category, date, description, optional receipt image.
- Category breakdown chart (donut/bar), spending over time (line/area), monthly budget progress bars.
- Group creation, expense splitting (even/percentage/exact), derived balances, settle up.
- Department groups with claim submission, approval workflow (submitted → approved/rejected → reimbursed).
- Dashboard as landing page with totals, recent activity, quick-add.
- Search and filter expenses by category, date range, amount range.
- Dark mode (Phase 4).
- Empty states designed with intent, not left blank.

**Technical constraints:**
- Frontend: React 19, TanStack Router (file-based), TanStack Query, TanStack Table, TanStack Form, Recharts, Tailwind CSS v4.
- Backend: Hono on Node.js, Drizzle ORM, PostgreSQL, BetterAuth.
- Monorepo: pnpm workspaces (server, app, packages/shared).
- All API responses normalized: `{ success: true, data }` / `{ success: false, error: { code, message } }`.

**Undecided:**
- Exact dark mode token strategy (Phase 4 decision).
- Receipt upload UX: drag-and-drop vs click-to-upload (Phase 4 decision).

## Brand Commitments

- **Name**: Vault
- **Voice**: Professional, confident, understated. No playful copy or developer humor visible to the recruiter audience. The work speaks.
- **Aesthetic direction**: Warm and friendly, following the Monzo/Revolut family — approachable, rounded corners, softer palette, not cold/corporate.

## Evidence on Hand

- `prd.md` — full product requirements document.
- `CONTEXT.md` — domain glossary (Expense, Scope, Group, Split, Claim, Settlement, Membership, Category, Budget).
- `DECISIONS.md` — all architecture decisions recorded.
- `docs/adr/0001-derived-balances.md` — ADR for derived vs materialized balances.
- `docs/adr/0002-unified-group-model.md` — ADR for unified Group model.
- Server code scaffolded: Hono entry, Drizzle schema (9 tables + relations), BetterAuth config, 6 resource routers (expenses full CRUD, others stubbed).
- Frontend scaffolded: Vite config, TanStack Router plugin, root route with nav, Tailwind v4.

## Product Principles

1. **UI-first, backend-minimal**: Every backend decision serves the frontend story. No overbuilt APIs — just enough for realistic loading states and optimistic updates.
2. **Show, don't tell**: The portfolio demonstrates patterns (file-based routing, search-param filters, optimistic mutations, type-safe contracts) rather than describing them in comments or README.
3. **Polish is the product**: Empty states, transitions, responsive behavior, and chart quality are not Phase 4 decorations — they're the core deliverable.
4. **Realistic scope, honest boundaries**: No mock data fakery beyond what auth requires. If it's not built, it's not shown.
5. **Warm over cold**: The visual tone is approachable and human, not sterile SaaS. Rounded, softer, inviting — like Monzo makes banking feel friendly.
