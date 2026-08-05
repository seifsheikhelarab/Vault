# Active members create Expenses as payer

Any active Better Auth member may create a new Expense in a social Group. The authenticated creator is always the payer; creating an Expense on behalf of another user is not part of the golden path. Only the payer may create later revisions or a deletion tombstone. Owners/admins may review governed Adjustments but cannot silently edit another member's Expense. Pending invitees, departed members, and members of closed Groups cannot create Expenses.

The alternative — restricting creation to admins — makes ordinary participants dependent on administrators for normal ledger activity. Allowing payer selection introduces attribution and authorization ambiguity before the core shared-expense flow is stable.

The trade-off is that every active member can add ledger records, so server-side membership, Group-kind, closed-state, and atomic Split validation must be enforced on creation. This keeps participation broad while keeping payer ownership unambiguous.
