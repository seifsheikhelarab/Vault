# Active Members only for new Expense participants

A new social Group Expense may select only active Better Auth Members of that same Group as participants. Pending invitees, departed members, users from another Group, and an opted-out payer are invalid participants. The server validates the participant set against the Organization's current Members during the same atomic write that creates the Expense and Splits.

The alternative — allowing pending invitees or arbitrary Vault users — creates new financial liability outside the active Group membership boundary and makes balances actionable before a person has accepted membership. Historical revisions may preserve departed participants under the frozen-share rule, but new Expenses may not add them.

The trade-off is that a payer must wait for an invitation to be accepted before including that person in a new Expense. This keeps active financial participation aligned with Better Auth membership and prevents client-side participant lists from becoming authorization inputs.
