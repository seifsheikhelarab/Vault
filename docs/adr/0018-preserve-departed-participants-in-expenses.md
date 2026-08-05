# Preserve departed participants in existing Expenses

If a participant later leaves a Group, existing Group Expenses may retain that participant and their immutable identity snapshot. The payer may edit the Expense without rewriting the historical participant identity, but new allocations may not add a departed user. The existing departed participant's Split remains part of the Expense until the edit policy resolves whether its amount is frozen.

The alternative — requiring every edited Expense to contain only active members — would make historical corrections erase or replace a former participant's financial identity. Freezing the entire Expense would preserve history more strongly but make ordinary corrections unnecessarily difficult. Preserving the participant keeps the ledger intelligible while limiting new financial relationships with inactive members.

A departed participant's existing Split amount is frozen during later edits. The payer may change the Expense amount and active participants only if the complete allocation still reconciles without changing the former participant's `amountCents`. If it cannot, the edit is rejected and the correction must use a compensating Expense. This prevents an edit from creating a new or larger debt to an inactive member.
