# Surface Brief: Vault — Full App Shell + Dashboard

## 1. Job and audience

**Visitor**: Recruiter or hiring manager scanning a frontend portfolio piece. They arrive from a resume link or GitHub profile. State of mind: 30-60 seconds to decide if this engineer understands modern React patterns.

**Visitor mode**: Operate — they're evaluating the artifact, not using it. But the artifact must feel operable: real data, real transitions, real loading states. A static mockup fails the credibility test.

## 2. Outcome and proof

**Primary thing**: Within one viewport, the recruiter must see a polished, data-rich dashboard that demonstrates TanStack ecosystem fluency — not in comments, but in behavior. Charts that feel real, tables that sort, filters that live in the URL, optimistic mutations that snap.

**Success looks like**: "This person builds production-quality UIs." The dashboard is the first proof. The nav shell + route structure is the second (shows architectural thinking). Empty states on routes with no data yet are the third (shows attention to craft).

**Real evidence**: Category breakdown chart, spending-over-time chart, budget progress bars, recent expense list, quick-add expense flow. All wired to real API data via TanStack Query.

## 3. Selected direction

**Visual authority**: Warm/friendly, Monzo/Revolut family. Approachable, rounded, softer palette — not cold SaaS gray. Recruiter audience expects professional polish; this audience rewards warmth that doesn't sacrifice density.

**Structural thesis**: Dashboard-first, progressive disclosure. The landing page is a dense-but-scanable overview: two-column layout with summary cards (totals) at top, charts in the middle, recent activity + quick-add at bottom. Navigation is a persistent sidebar or top nav that makes the app feel like a real product, not a single-page demo.

**Focal moment**: The category breakdown chart — colorful, animated, immediately tells the recruiter "this person can build real data visualizations, not just wireframe boxes."

**Implementation consequence**: Every component must be wired to TanStack Query (loading/success/error states visible), TanStack Router (search params for filters), and demonstrate optimistic updates where applicable.

## 4. Scope and boundaries

**Fidelity**: Production-ready. Real data, real interactions, real loading states. Not a wireframe, not a prototype.

**Breadth**: Full app shell (all 8 routes from PRD) with consistent nav, layout, and visual language. Dashboard is fully built. Other routes: expense list (full), add expense (full), groups/company/settings (functional shells with empty states or basic content).

**What remains untouched**: Auth UI (login/signup screens) — BetterAuth handles that. Dark mode — Phase 4. Drag-and-drop receipt upload — Phase 4.

**Anti-goals**: No placeholder lorem ipsum. No "coming soon" text. No generic card grids. Every empty state is designed with intent (as PRD specifies).

## 5. States and ranges

**Realistic data ranges**:

- Dashboard: 0-50 expenses in the recent list, 3-8 categories, 1-12 months of spending data
- Expense list: 0-500 expenses with pagination
- Budgets: 0-8 active budgets with progress 0-150%

**Material states**:

- Empty state (new user, no expenses yet) — designed with intent, not blank
- Loading state (charts fetching, data loading) — skeleton screens or shimmer
- Error state (API failure) — graceful degradation
- Success state (expense added, claim approved) — subtle confirmation
- Overflow state (many expenses) — pagination, virtual scroll, or infinite scroll

## 6. Interaction and layout

**Layout topology**: Top nav with app name (Vault), nav links (Dashboard, Expenses, Groups, Company, Settings), and user avatar. Content area below.

**Dashboard layout**:

- Top row: 3-4 summary cards (total spent this month, remaining budget, active groups, pending claims)
- Middle row: Two charts side by side (category breakdown donut + spending over time line)
- Bottom row: Recent expenses table (TanStack Table) + quick-add button

**Responsive behavior**: Mobile collapses to hamburger nav, charts stack vertically, summary cards go full-width. Tablet: charts side-by-side, table full-width.

**Primary action**: "Add expense" button — prominent, always accessible, opens the add expense form (separate route).

**Feedback**: Optimistic update on add/delete (instant UI response, rollback on error). Chart animations on data load. Subtle transitions on nav active states.

## 7. Constraints and open decisions

**Binding constraints**:

- TanStack Router file-based routing — routes must follow the naming convention
- TanStack Query for all data fetching — no raw fetch/axios
- TanStack Table for expense list — sortable, filterable, paginated
- Tailwind CSS v4 — no custom CSS unless Tailwind can't express it
- Recharts for charts — must feel animated and responsive
- Warm/friendly palette — Monzo/Revolut family, not cold corporate

**Open decisions** (deferred to new-work):

- Exact color palette (warm base, accent color, semantic colors)
- Typography choices (font family, scale, weights)
- Component language (border radius, shadow, spacing rhythm)
- Dark mode token strategy (Phase 4)

**Accessibility**: Standard web a11y — semantic HTML, keyboard navigation, sufficient contrast, aria labels on interactive elements. No specific WCAG target beyond reasonable defaults.
