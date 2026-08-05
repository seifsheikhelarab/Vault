# Tombstone User identities with financial history

A User who appears in any financial ledger record cannot be hard-deleted. Their account is tombstoned: active sessions and participation are revoked, new financial activity is blocked, and historical Expenses, Splits, Settlements, and balance explanations retain the stable user identity and a display snapshot. A User with no financial history may be hard-deleted.

The alternative — allowing Better Auth user deletion to cascade through financial foreign keys — erases the identity needed to explain historical balances and conflicts with the requirement to preserve ledger history. Anonymizing the records would protect deletion semantics but weaken the audit trail and make past Group activity harder to understand.

The trade-off is retaining a minimal inactive identity record after account deletion. That retained identity is necessary for financial integrity; the account's active authentication data and access can still be revoked or removed according to the authentication layer's privacy policy. The current cascade-delete configuration must therefore be replaced or guarded by a ledger-history check.
