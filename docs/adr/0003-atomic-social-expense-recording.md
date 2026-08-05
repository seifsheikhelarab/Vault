# Atomic recording of social Group expenses

A social Group Expense is recorded together with its complete set of Splits in one operation. The current user is the payer in the golden-path flow and is included in the participant list by default, but may opt out. At least one participant is required; the participants and split method are selected during recording, and the split amounts must reconcile to the full Expense amount.

The alternative — saving an Expense first and configuring Splits afterward — allows an invalid or ambiguous ledger state. Balances could be computed from an expense whose allocation is incomplete, and users could see contradictory results between the expense list and the balance view.

Atomic recording keeps the social ledger valid at every observable point and makes the golden path immediate: record the shared expense, see who owes whom, and settle the resulting debt. The same transaction boundary applies to later edits: only the payer/creator may edit or delete a Group Expense, and an edit replaces the Expense and its complete Split set together. Splits are not independently editable. The trade-off is a more involved recording flow and the need for transaction boundaries in the backend.
