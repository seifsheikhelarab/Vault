# Idempotent financial commands

Creating an Expense, Adjustment, Settlement, or Settlement repair requires a client-provided idempotency key. The server scopes the key to the authenticated User and operation type, stores the first successful result, and returns that same result for an identical retry. Reusing a key with a different payload is rejected. Idempotency deduplication and the financial write occur within one database transaction.

The alternative — relying on disabled buttons or client-side query behavior — cannot prevent duplicate writes after a timeout or when multiple clients submit the same command. Allowing duplicates and correcting them later is especially dangerous for payments and append-only financial history.

The trade-off is an idempotency record and payload comparison on command paths. That small amount of infrastructure makes retries safe and preserves the append-only ledger invariants under normal network failure.
