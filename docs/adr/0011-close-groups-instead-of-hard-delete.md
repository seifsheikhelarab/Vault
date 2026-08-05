# Close Groups instead of hard deleting financial history

A Group is closed rather than hard-deleted. Only the Better Auth owner may close it, and only when its derived balance is zero. Closure preserves the Group, linked Organization identity, Expenses, Splits, Settlements, and historical member identities as read-only history. New expenses, invitations, membership changes, and settlements are disabled.

The alternatives — hard deletion when empty or at any time — risk irreversible loss of financial context and conflict with the requirement that historical user identity remain attached to the ledger. A closed Group also gives users a stable explanation for past balances and settlements without requiring a separate export or archive system.

The trade-off is retaining records and adding a closed lifecycle state. That state is preferable because financial history is more valuable than reclaiming storage at portfolio scale, and it allows the product to enforce safe destructive behavior through a simple owner-only transition.
