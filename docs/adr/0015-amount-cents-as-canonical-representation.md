# `amountCents` as the canonical money representation

`amountCents` is canonical in PostgreSQL storage, shared types, API contracts, and domain services. The database uses an integer-compatible representation, services calculate only in integer cents, and the UI converts human currency input to cents and cents to formatted currency at the presentation boundary.

The alternative — retaining `numeric(12,2)` or dollar-valued API numbers and converting only inside calculation helpers — leaves the unit implicit and makes it easy to mix dollars and cents across layers. An explicit `amountCents` name makes the invariant visible to every caller and prevents display formatting from becoming financial truth.

The trade-off is migration work across the schema, API, tests, and UI, plus explicit formatting at the presentation boundary. That migration is justified because the golden path depends on reproducible split and settlement arithmetic.
