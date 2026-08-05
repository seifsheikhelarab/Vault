# Permanent Group closure

Closing a Vault Group is irreversible. Once closed, the Group remains read-only permanently; its linked Better Auth Organization and Member records are preserved as inert historical identity, while invitations, membership changes, Expenses, Adjustments, and Settlements are blocked. Future shared activity requires a new Group and Organization.

The alternatives — allowing the owner to reopen or permitting support-only reopening — reintroduce uncertainty about whether the preserved membership and historical balance context is still appropriate for new financial activity. A monotonic lifecycle is easier to reason about and audit: active becomes closed, never active again.

The trade-off is that a user must create a new Group when a closed context becomes relevant again. This is preferable to mutating a historical ledger back into an active one and keeps old identity, approvals, and balances permanently explainable.
