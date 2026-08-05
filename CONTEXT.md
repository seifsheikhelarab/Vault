# Expense Tracker

A web app for tracking personal, group, and company expenses.

## Language

**User**:
A Vault identity that may participate in Groups and financial records. A User with ledger history cannot be hard-deleted: the identity is tombstoned, access is revoked, and historical Expenses, Splits, Settlements, and balance explanations retain a stable display snapshot. Financial records also retain immutable name/email snapshots for every human identity they display (payer, split participant, settlement sender/recipient, claim submitter/reviewer). Profile changes affect future records only. A User with no financial history may be hard-deleted.
_Avoid_: Account (use User for the identity; account describes authentication state)

**Expense**:
A recorded outflow of money: amount, category, date, payer, optional receipt. The core unit across personal and Group contexts. Its allowed behavior is determined by the containing Group's authoritative `kind` and its valid extensions, not by a freely mutable scope field. In a social Group, an Expense is only valid when its complete set of Splits is recorded atomically with it and reconciles to the full amount. The current user is the payer in the golden-path flow; any active Better Auth member may create a new social Expense, and the authenticated creator is always its payer. The payer is included by default but may opt out of the participant list. Pending invitees, departed members, and members of closed Groups cannot create Expenses. Group Expenses may only be changed by their payer/creator through append-only revisions: the original Expense and Splits remain preserved, while a new current revision atomically replaces the complete allocation and records author, timestamp, and reason. Revisions must preserve frozen departed-participant shares. Deleting an Expense creates an append-only tombstone authored by the payer with a mandatory reason; the original, revisions, and Splits remain inspectable, while the inverse of the current revision removes its active balance effect. A deletion is rejected when that inverse would make an existing Settlement excessive or otherwise invalid; the user must use an Adjustment or compensating Settlement instead. Corrections that cannot preserve a departed participant's frozen share use a separate Adjustment rather than a negative Expense.
_Avoid_: Transaction, charge, purchase (too generic), claim (use Claim for the company workflow)

**Scope**:
A tag on Expense indicating context: `personal`, `group`, or `company`. Determines which extension model applies, not the expense's identity.
_Avoid_: Type, kind

**Group**:
A named collection of users. Has an authoritative `kind` (`social` or `department`) that determines allowed financial behavior: social Groups use Splits, derived balances, Settlements, and social corrections; department Groups use Budgets and Claims and do not use peer Splits, balances, or Settlements. The server rejects extensions that do not match the Group kind. Better Auth client methods may provide the frontend UX, but server-side Better Auth hooks/guards are the authoritative enforcement boundary for invitations, acceptance, roles, ownership transfer, departure, removal, and closed-Group behavior; client calls never bypass Vault financial invariants. These guards run pre-commit: failed Vault validation aborts the Better Auth mutation atomically, with compensation reserved for unexpected infrastructure failure. Every Group has exactly one linked Better Auth Organization, recorded by Organization ID; that Organization is the Group's active membership container. Group and Organization creation is one idempotent, compensating product operation: Vault does not knowingly leave either record orphaned when the other fails. A Group can be closed only by its owner when its derived balance is zero; closure is permanent. Closure preserves the read-only ledger and historical identities while disabling new expenses, invitations, membership changes, Adjustments, and settlements. Its linked Better Auth Organization and Member records remain for historical identity but become inert: pending invitations are cancelled and no direct organization operation may mutate the closed financial context. Future activity requires a new Group and Organization. All share membership and expense routing.
_Avoid_: Department (use Group with kind=department), team

**Split**:
A share of an Expense owed by one user within a Group. One expense generates many splits. The split model depends on Group kind: social groups split by even/percentage/exact, departments don't split (company absorbs the cost). For social expenses, the splits are part of the same recording operation as the Expense; at least one participant is required and the amounts must sum exactly to the Expense amount. The payer is included by default but may opt out. Even and percentage allocations use canonical Better Auth membership order (creation time, then user ID) for remainder cents; percentages are integer basis points from 0 to 10,000. A selected participant for a new social Expense must be an active Better Auth Member of that Group; pending invitees, departed users, and users outside the Group cannot receive new liability. A selected participant may receive a zero-cent Split; that Split is retained to preserve the recorded participant/percentage choice but does not affect balances. If a participant later leaves, existing Expenses may retain that participant and their immutable identity snapshot, but new allocations may not add the departed user. The departed participant's existing `amountCents` is frozen during later edits; an edit that cannot reconcile without changing it is rejected in favor of a compensating Expense.
_Avoid_: Share, allocation

**Claim**:
An expense submission in a department Group, entering an approval workflow. States: submitted → approved/rejected → reimbursed. Only exists on expenses inside department-kind Groups.
_Avoid_: Submission, request

**Adjustment**:
A signed correction linked to an existing Expense. An Adjustment preserves the original Expense, carries a signed cent amount and signed per-participant allocation deltas, requires a reason, and participates in derived balances only after approval. Pending requests have no effect on balances, settlements, membership departure, or Group closure; rejected requests remain audit history without financial effect. The original payer creates the request; a Group owner/admin other than the requester approves or rejects it. The requester cannot self-approve or self-reject. If no other eligible reviewer exists, the request remains pending until one does or the requester cancels it. If the requester leaves the Group while it is pending, the request is automatically cancelled and remains audit history. Once approved, it is immutable. Pending and rejected requests are visible to the requester and Group owners/admins only; other members see only approved financial outcomes. The allocation deltas must sum exactly to the Adjustment total. Positive new liability may only be assigned to active members; a departed participant's original share may only be reduced by an explicit reversal. It is used when an Expense edit cannot preserve a departed participant's frozen share; it is not a negative Expense.
_Avoid_: Refund (use Adjustment for a ledger correction; a refund may be an external event)

**Settlement**:
A record that a debt between two users has been paid. Balances are always derived (computed from Expenses + signed Adjustment allocation deltas + Settlements), never materialized. This eliminates consistency bugs. In a social Group, the payer is the current user, both users must be members, the recipient must be a derived creditor, and the positive amount may not exceed the outstanding debt. Partial settlements are valid; Settlement history is append-only and corrections use a compensating Settlement. A Settlement is group-level rather than tied to one Expense, and stores immutable payer/recipient identity snapshots plus the derived-debt context immediately before payment. An incorrect Settlement is corrected through a reasoned request and an approved, immutable compensating Settlement linked to the original; the original payer or recipient may self-approve when they are an eligible owner/admin. The correction must be the exact inverse of the original Settlement: reversed direction and identical `amountCents`. It may reverse that payment for a departed identity but may not be partial, oversized, redirected, or create unrelated debt. If the real-world correction is only partial, Vault atomically records the exact inverse and a new normal Settlement for the corrected amount; the replacement is subject to normal active-membership and debt validation. If the replacement would pay a departed member, the partial repair is rejected; only the exact inverse may be recorded. This self-approval exception does not apply to Adjustment requests.
_Avoid_: Payment, transaction, settle-up (use Settlement for the record, "settle up" for the action)

**Invitation**:
A pending request from a Group admin to add a user to a Group. Vault reuses the existing Better Auth Organization invitation lifecycle, which can target users who do not yet have an account. Better Auth owns invitation tokens, recipient binding, account creation, verification, expiry, and acceptance semantics; Vault only enforces that the linked Group exists, is valid, and is not closed. An Invitation must be accepted before it creates an active Better Auth Organization `Member`; every invitation creates a `member`, and only the owner may later promote that active member to `admin`. Acceptance automatically activates financial membership in the linked Vault Group, with no second join or admin-confirmation step. An invitation does not participate in balances, expenses, or permissions until accepted. The Better Auth Organization and the domain Group must have an explicit relationship; they must not drift as unrelated records.
_Avoid_: Invite (use Invitation for the record, "invite" for the action)

**Membership**:
A user's active relationship to a Group, represented solely by the Better Auth Organization `Member` record. Better Auth `owner` and `admin` roles map to Vault admin capabilities; `member` maps to Vault member capabilities. Roles are per-Organization/Group — a user can be admin in one group and member in another. The creator is the initial owner; only the owner may promote or demote roles, transfer ownership through an explicit audit event, or close/delete the Group/Organization. An owner must transfer ownership to another active admin before leaving, tombstoning their account, or relinquishing control; the Group cannot become ownerless. Admins may manage invitations and removals subject to lifecycle guards, but cannot escalate roles or transfer ownership. Vault reads Better Auth membership records for financial participation and must enforce that a member may leave, or be removed by an admin, only when their derived balance in that Group is zero. Ending Membership never erases historical identity: past Expenses, Splits, Settlements, and balance history retain the user's identity. A former member retains read-only access to historical records of direct involvement, including closed-Group history: Expenses they created or paid, Splits assigned to them including zero-cent Splits, Settlements where they were sender or recipient, Adjustment deltas involving them, related revision/deletion events, and correction requests they submitted or reviewed. They cannot see later activity, unrelated records, or perform financial or membership mutations.
_Avoid_: Membership role (just use role), user role (too vague)

**Category**:
A label for classifying expenses (Food, Transport, Entertainment). Global list with user-level customization. Groups inherit from the creator's categories.
_Avoid_: Tag (too generic), type

**Money**:
All financial calculations use integer cents. `amountCents` is the canonical field in database storage, shared types, API contracts, and domain services; dollar formatting exists only at the UI presentation boundary. PostgreSQL stores it as `bigint`; JSON exposes it as a safe integer `number`, bounded by `Number.MAX_SAFE_INTEGER`. Every monetary input boundary validates `amountCents` as an integer within the allowed range; Expense, Settlement, and Budget amounts must be positive, while a Split may be zero when a selected participant's allocation rounds to zero. The server converts database bigint values to safe numbers before serialization. Even and percentage Splits allocate any remainder cents through canonical Better Auth membership order (creation time ascending, then user ID); percentage inputs use integer basis points from 0 to 10,000. Exact Splits and all derived balances must reconcile exactly, without hiding discrepancies through floating-point tolerance. Display formatting may show two decimal places, but display rounding is never the source of truth. Each Expense, Split, Settlement, and Budget amount is also bounded by a business maximum of $1,000,000 (100,000,000 cents), below the technical safe-integer ceiling.
_Avoid_: Floating-point amount, approximate balance

**Budget**:
A spending limit for a Category over a time period. For personal use, applies to the user globally (group_id null). For departments, applies to a Group. Rendered as a progress bar in both cases.
_Avoid_: Cap, allowance

**Idempotency**:
Financial commands—creating an Expense, Adjustment, Settlement, or Settlement repair—require a client-provided idempotency key. The server scopes the key to the authenticated user and operation type, stores the first successful result, returns it for identical retries, and rejects reuse with a different payload. Deduplication and the financial write occur in one transaction.
_Avoid_: Client-only deduplication

**Audit Event**:
An immutable record of a consequential financial, membership, role, ownership, or Group-lifecycle action. It stores the actor identity snapshot, action type, Group, target record, timestamp, reason when applicable, and before/after references where applicable. Financial records remain the source of truth; the unified audit stream explains who changed what and why. Visibility follows participation and role boundaries. Financial facts and event structure remain immutable forever, while personal snapshot fields may be replaced with a canonical `Deleted user` representation only through a controlled, separately audited privacy-redaction operation.
_Avoid_: Log (too operational; use Audit Event for domain history)

## Tech Stack

**Frontend**: React + TanStack Router (file-based, loaders, search params), TanStack Query (caching, optimistic updates), TanStack Table (sortable/filterable lists), TanStack Form (validation, submission), Recharts (charts), Tailwind

**Backend**: Hono (Web Standards, ultrafast, TypeScript-first)

**Database**: PostgreSQL + Drizzle ORM (type-safe schema, migrations, relational + SQL query APIs)

**Auth**: BetterAuth (self-hosted, open source, email/password + OAuth plugins)

**File Storage**: Cloudinary (receipt uploads)
