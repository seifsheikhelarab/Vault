# Settlement correction self-approval exception

An original Settlement payer or recipient who is an eligible Group owner/admin may approve their own compensating Settlement correction. The correction must include a reason, link to the original Settlement, remain immutable after approval, and be limited to correcting that payment. This exception does not apply to Expense Adjustments, whose requester may not self-approve.

The alternative — requiring an independent reviewer for every Settlement correction — would apply the Adjustment approval model mechanically even though a Settlement correction is constrained to reversing a specific payment rather than changing the underlying expense allocation. The opposite alternative — allowing any self-approved payment mutation — would violate append-only history and permit unrelated debt.

The trade-off is reduced separation of duties for this narrowly bounded correction. The linked original Settlement, mandatory reason, immutable compensating record, and no-unrelated-debt validation keep the scope of the self-approved action explicit.
