# Strict settlements against derived group debt

A Settlement in a social Group is valid only when both users are members, the current user is the payer, the recipient is a current derived creditor, and the amount is positive and no greater than the outstanding debt. Partial settlements are allowed. Settlement history is append-only; corrections use a compensating Settlement rather than editing or deleting history.

The alternative — accepting arbitrary manual payment entries — allows settlements that do not correspond to the ledger, can create overpayment, and makes the balance view difficult to explain. Requiring the recipient to be a derived creditor also keeps the action aligned with the “who owes whom” result shown to the user.

The trade-off is that the product cannot record informal payments that are not yet represented by an Expense or cannot handle out-of-band corrections with a simple free-form entry. That boundary is preferable for the golden path because every visible settlement has a clear effect on a valid derived debt.
