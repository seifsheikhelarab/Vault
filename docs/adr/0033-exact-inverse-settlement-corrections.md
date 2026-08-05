# Exact-inverse Settlement corrections

A compensating Settlement must be the exact inverse of its original Settlement: the direction is reversed and `amountCents` is identical. It must remain linked to the original, carry a reason, and be immutable after approval. Partial, oversized, redirected, or unrelated corrections are not represented as compensating Settlements.

The alternative — allowing partial or custom corrections — makes a correction indistinguishable from a new payment and weakens the guarantee that it only repairs the linked original event. Exact inversion keeps the correction bounded and makes the pair cancel mathematically in the append-only ledger.

For a partially incorrect real-world payment, Vault atomically records the exact inverse of the original Settlement and a new normal Settlement for the corrected amount. The replacement must satisfy normal active-membership and derived-debt validation. This preserves the exact-inverse meaning while supporting practical corrections; if either record fails validation, neither is committed.
