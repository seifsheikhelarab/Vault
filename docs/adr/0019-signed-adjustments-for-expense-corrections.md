# Signed Adjustments for Expense corrections

When a Group Expense cannot be edited while preserving a departed participant's frozen Split, Vault creates a separate Adjustment linked to the original Expense. The Adjustment carries a signed `amountCents` value and signed per-participant allocation deltas, requires a reason, and participates in derived balances. The allocation deltas must sum exactly to the Adjustment total. Positive new liability may only be assigned to active members; a departed participant's original share may only be reduced by an explicit reversal. The original Expense remains unchanged history; an Adjustment is not a negative Expense.

The alternative — allowing negative Expenses — weakens the meaning of Expense as a recorded outflow and makes the existing positive amount invariant ambiguous. Replacing an Expense with a corrected copy preserves the original record but complicates balance derivation and makes correction chains harder to explain.

The trade-off is another ledger record type, a signed amount boundary, and participant-level delta validation. That complexity keeps the original Expense auditable, supports corrections around frozen former-member shares, and makes the balance computation explicit: Expenses + signed Adjustment allocation deltas + Settlements.
