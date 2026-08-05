# Signed participant allocation deltas for Adjustments

Every Adjustment linked to an Expense carries signed per-participant allocation deltas. The deltas must sum exactly to the Adjustment's signed `amountCents` total and are included directly in derived balances. Positive new liability may be assigned only to active members. A departed participant's original share may only be reduced by an explicit reversal; an Adjustment may not create new positive liability for that inactive identity.

The alternative — applying a correction only to the Group total — leaves the balance computation unable to explain who gained or lost liability. Fully reversing and recreating the Expense is more rigid and creates unnecessary correction chains. Participant-level deltas preserve the original record while making the correction's effect auditable.

The trade-off is more validation at the Adjustment boundary: the server must validate sign, membership status, frozen former-member rules, exact cent reconciliation, and the required reason before writing the record.
