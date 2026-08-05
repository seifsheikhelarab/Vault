# Group-level Settlements with context snapshots

A Settlement remains a group-level payment rather than referencing one Expense. A single payment may settle aggregate debt accumulated across multiple Expenses and approved Adjustments. At creation time, the Settlement stores immutable payer and recipient identity snapshots, the Group identity, the amount in cents, and the derived debt context immediately before payment.

The alternative — tying each Settlement to one Expense — prevents a natural payment from settling aggregate debt and complicates the net-debt model. Keeping only the current payer, recipient, and amount without context makes later revisions or deletion attempts harder to explain, even when the derived arithmetic remains correct.

The trade-off is additional immutable context data on Settlements and validation that the snapshot accurately represents the derived debt at creation. This preserves aggregate settlement simplicity while making payment history auditable and supporting validation against later ledger changes.
