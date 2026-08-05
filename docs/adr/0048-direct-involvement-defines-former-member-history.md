# Direct involvement defines former Member history

A former Group Member's read-only history consists only of records where their identity is directly involved: Expenses they created or paid, Splits assigned to them including zero-cent Splits, Settlements where they were sender or recipient, Adjustment allocation deltas involving them, related revision and deletion events, and correction requests they submitted or reviewed. They may view this history even after the Group closes, but cannot see unrelated records or activity after departure and cannot perform financial or membership mutations.

The alternatives — exposing the entire historical Group ledger or showing only records created by the former member — either violate least privilege or omit the shared context needed to explain their own financial obligations and payments. Direct involvement provides a deterministic read filter and preserves the relevant audit trail.

The trade-off is that the read model must retain enough participation references to answer historical queries after active Better Auth membership ends. Those references are part of the financial audit model, not a reason to restore membership.
