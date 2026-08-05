# Block deletion that invalidates Settlements

A Group Expense deletion tombstone is rejected when applying the inverse of its current revision would make an existing Settlement excessive or otherwise invalid. The original Expense remains active, and the user must use a governed Adjustment or compensating Settlement to correct the ledger.

The alternative — allowing the deletion and accepting an overpayment or contradictory balance — makes the append-only Settlement history impossible to explain. Automatically creating compensating events would hide a consequential financial decision and make the user's delete action produce more records than they requested.

The trade-off is that “Delete” is conditional once an Expense has influenced settlement history. The UI must explain the conflict precisely and route the user toward a correction flow rather than presenting deletion as universally available.
