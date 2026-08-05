# Approved compensating Settlements for payment corrections

An incorrect Settlement is corrected through a reasoned correction request submitted by the original payer or recipient. An eligible Group owner/admin approves the request; unlike Adjustment requests, the requester may approve their own correction when they hold an eligible owner/admin role. Approval creates an immutable compensating Settlement linked to the original. The compensating Settlement may reverse the original payment, including for a departed identity, but may not create unrelated debt.

The alternative — editing or deleting the original Settlement — breaks append-only payment history. Allowing an admin to create an arbitrary reversal without a request makes the correction's intent and accountability unclear. Handling every payment error through an Expense Adjustment would also conflate payment correction with underlying expense correction. Settlement corrections intentionally permit self-approval for an eligible requester, unlike Adjustments, because the correction is constrained to reversing a specific existing payment rather than changing an underlying expense allocation.

The trade-off is a small request/approval lifecycle and linked settlement records. That preserves the original payment, makes the correction explainable, and keeps the aggregate debt model intact.
