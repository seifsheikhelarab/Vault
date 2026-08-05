# One-million-dollar business maximum for monetary amounts

Vault limits each Expense, Split, Settlement, and Budget amount to $1,000,000 (`100,000,000` cents). This business maximum applies in addition to the JSON/API requirement that `amountCents` remain a positive safe integer no greater than `Number.MAX_SAFE_INTEGER`.

The alternatives — $100,000 or $10,000,000 — are respectively too restrictive for some company workflows or too permissive for catching malformed input in a portfolio-scale expense product. The selected limit is generous across personal, social, and company contexts while still producing useful validation errors and preventing accidental unbounded values.

The trade-off is that an unusually large legitimate claim would need a future policy change or a different workflow. That is preferable to allowing technically safe but domain-incoherent amounts today.
