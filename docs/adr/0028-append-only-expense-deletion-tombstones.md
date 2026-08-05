# Append-only deletion tombstones for Group Expenses

“Delete Expense” creates an immutable deletion tombstone authored by the payer/creator with a mandatory reason. The original Expense, all revisions, and all Splits remain inspectable in history. The tombstone removes the current revision's active balance effect by applying its inverse to derived balances; no financial record is physically deleted.

The alternatives — hiding the Expense while leaving its balance effect, or physically deleting the record — either make the current view disagree with balances or destroy the historical explanation. A tombstone preserves auditability while making the user's delete intent financially effective.

The trade-off is that deletion becomes another ledger event and must be validated against existing settlements and membership lifecycle rules. A deletion tombstone is rejected when applying its inverse would make an existing Settlement excessive or otherwise invalid. The user must use an Adjustment or compensating Settlement instead, preserving the append-only settlement history.
