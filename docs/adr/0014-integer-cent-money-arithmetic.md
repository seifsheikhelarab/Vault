# Integer-cent money arithmetic

Vault treats money as integer cents at the domain boundary. Even and percentage Split calculations use integer basis-point percentages (`0`–`10,000`) and allocate remainder cents deterministically using Better Auth membership creation time ascending, with user ID as a tie-breaker. Selected participants may receive zero cents when a percentage allocation rounds to zero; the zero-cent Split remains stored as participant/allocation history but contributes nothing to balances. Exact Splits must sum exactly to the Expense amount, and derived balances must reconcile exactly. Floating-point tolerances are not used to hide discrepancies.

The alternative — JavaScript floating-point calculations with a one-cent tolerance — can create inconsistent results around percentage splits, multi-person rounding, and repeated balance derivation. Rounding only at display time also risks presenting values that do not match the ledger's actual arithmetic.

The trade-off is explicit conversion and formatting at API/UI boundaries and a documented deterministic allocation rule. That complexity buys reproducible balances and makes every cent explainable.
