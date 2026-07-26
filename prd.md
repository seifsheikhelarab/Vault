# PRD: Expense Tracker (Personal, Group, Company)

## Summary

A web app for tracking expenses at three levels: personal spending, shared group expenses (like a trip or a shared apartment), and company expenses (department budgets, employee submissions, approval flow). Built to practice frontend work with TanStack (Router, Query, Table, and possibly Form/Start). The backend is intentionally simple so the effort goes into UI: charts, transitions, empty states, responsive layout.

## Goals

- Build a real, working app that looks good, not a wireframe.
- Get hands-on reps with TanStack Router (nested routes, loaders, search params) and TanStack Query (caching, mutations, optimistic updates).
- Practice component structure and state management in React at a level beyond basic CRUD forms.
- End up with a portfolio piece that shows frontend range next to the backend-heavy projects.

## Non-goals

- Real payment processing or bank integration.
- Production-grade auth (a simple mock login or single-user mode is fine for v1).
- Multi-currency support in v1.
- Mobile app. Responsive web is enough.

## Users

**Individual user**: tracks personal spending, wants to see where money goes by category and over time.

**Group member**: part of a shared expense pool (trip, household, friend group), needs to see who owes who and settle up.

**Company admin**: manages a team's expenses, sets budgets per category or department, reviews and approves employee submissions.

**Company employee**: submits expense claims, attaches receipts, tracks approval status.

## Core features

### Personal tracking
- Add/edit/delete expenses with amount, category, date, note, optional receipt image.
- Category breakdown (donut or bar chart).
- Spending over time (line or area chart), filterable by date range.
- Monthly budget per category with a progress indicator.

### Group expenses
- Create a group, invite members (mock invite for v1, no real email needed).
- Log a shared expense and split it: evenly, by percentage, or by exact amount per person.
- Running balance per member: who owes who, net amount.
- Settle up flow: mark a debt as paid, log it, balances update.

### Company expenses
- Departments or teams, each with a budget.
- Employees submit expense claims with category, amount, receipt, note.
- Admin view: pending claims queue, approve/reject with a comment.
- Budget vs actual spend per department, visualized.
- Status tracking for employees: submitted, approved, rejected, reimbursed.

### Shared across all three
- Dashboard as the landing page: totals, recent activity, quick-add button.
- Search and filter expenses by category, date, amount range, person (for groups/company).
- Dark mode.
- Empty states designed on purpose, not left blank (no groups yet, no claims yet, etc).

## Tech stack

- **TanStack Router**: file-based routing, route loaders for data prefetching, search params for filters (so filter state lives in the URL, not just component state).
- **TanStack Query**: all data fetching and mutations, optimistic updates for things like marking a debt settled or approving a claim.
- **TanStack Table**: expense list views, sortable/filterable columns, pagination.
- **TanStack Form** (optional): the add/edit expense form, group creation form.
- Charting library of choice (Recharts or similar) for the visualizations.
- Tailwind for styling.
- Mock or lightweight backend: a local JSON store, or a simple Express/SQLite API if a real backend is wanted for realistic loading states.

## Data model (rough)

- **User**: id, name, email
- **Expense**: id, amount, category, date, note, payer_id, receipt_url, scope (personal/group/company), group_id or department_id (nullable)
- **Group**: id, name, members (list of user ids)
- **Split**: expense_id, user_id, share_amount
- **Department**: id, name, budget, company_id
- **Claim**: id, expense_id, status (submitted/approved/rejected/reimbursed), reviewer_id, reviewed_at

## Pages / routes

- `/` — dashboard (context-aware: personal by default, switchable to a group or company view)
- `/expenses` — full expense list/table with filters
- `/expenses/new` — add expense
- `/groups` — list of groups
- `/groups/:id` — group detail, balances, expense list, settle up
- `/company` — department overview, budget vs actual
- `/company/claims` — claims queue (admin) or my claims (employee)
- `/settings` — categories, budgets, dark mode toggle

## Phases

**Phase 1 (MVP)**: personal tracking only. Add/edit/delete expenses, category chart, spending-over-time chart, budget progress. This alone is enough to exercise Router, Query, and Table.

**Phase 2**: groups. Group creation, splitting logic, balance calculation, settle up.

**Phase 3**: company. Departments, claims, approval flow, admin dashboard.

**Phase 4 (polish)**: dark mode, receipt upload with drag-and-drop, micro-interactions (animated number transitions on totals, chip animations), loading/empty state pass across the whole app.

## Open questions

- Real backend or mock data layer? Affects how much loading-state work is worth doing.
- Single-user mode or basic auth for v1? Auth adds real scope for very little frontend payoff.
- Receipt storage: local file, or skip actual storage and just handle the upload UI?