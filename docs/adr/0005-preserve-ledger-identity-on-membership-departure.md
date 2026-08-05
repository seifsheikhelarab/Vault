# Preserve ledger identity when Membership ends

A user's historical identity remains attached to every Expense, Split, and Settlement after their Membership in a Group ends. A member may leave voluntarily, or be removed by an admin, only when their derived balance in that Group is zero.

The alternative — allowing departure with an outstanding balance — requires a former-member state and a settlement flow that can pay inactive members. The other alternative — deleting or anonymizing the user references — corrupts the explanation of historical balances and makes the ledger unauditable.

Keeping departure blocked until the balance is zero preserves a simple, actionable social ledger while retaining historical identity. The trade-off is that a group cannot remove an unsettled member as an administrative convenience; the debt must be resolved first.
