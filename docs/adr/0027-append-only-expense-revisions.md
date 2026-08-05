# Append-only revisions for Group Expenses

The Group Expense edit experience is implemented as an append-only revision. The original Expense and its original Splits remain preserved; a new current revision atomically replaces the complete allocation and records the author, timestamp, and reason. Revisions must preserve frozen departed-participant shares. The current view resolves to the latest revision while history remains inspectable.

The alternative — in-place atomic mutation — would keep the ledger valid at each point but silently rewrite the original financial explanation and undermine immutable identity and Adjustment auditability. Making Expenses fully immutable would preserve history but make ordinary corrections unnecessarily cumbersome.

The trade-off is a revision model, current-revision resolution, and additional storage. That cost buys an auditable history while retaining a familiar Edit Expense workflow and the atomic Expense/Split invariant.
