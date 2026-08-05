# Pending Adjustments have no financial effect

A pending Adjustment request does not affect derived balances, settlement validation, membership departure checks, or Group closure. The original ledger remains authoritative until an owner or admin approves the request. An approved Adjustment applies at its approval timestamp, becomes immutable, and is included in future balance derivation. A rejected request remains visible as audit history but never affects money.

The alternatives — showing only provisional projected balances or applying the change immediately and rolling it back — make it possible for users to settle against a correction that may not be approved and complicate lifecycle invariants. Keeping pending requests non-financial gives every active balance a single clear source of truth.

The trade-off is that a requester cannot see the correction in their official balance until review completes. The pending request can still display a separate explanation of its status without changing the authoritative ledger.
