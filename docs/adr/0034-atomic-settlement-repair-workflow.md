# Atomic inverse-plus-replacement Settlement repair

When a real-world Settlement was partially incorrect, Vault repairs it by atomically recording two immutable events: the exact inverse of the original Settlement and a new normal Settlement for the corrected amount. The inverse must reverse direction and match the original amount exactly. The replacement is subject to ordinary active-membership, creditor, amount, and derived-debt validation. If either event fails, neither is committed.

The alternative — allowing a partial compensating Settlement — makes a correction indistinguishable from a new payment and weakens the exact-inverse invariant. Reversing without recording the corrected payment leaves the ledger incomplete and forces the user to manage the replacement outside Vault. Using an Expense Adjustment would conflate a payment error with an underlying expense correction.

The trade-off is a transaction containing two linked immutable events and a more involved correction UI. That complexity preserves mathematical cancellation, supports real-world partial corrections, and keeps the ordinary Settlement rules authoritative for the replacement payment.
