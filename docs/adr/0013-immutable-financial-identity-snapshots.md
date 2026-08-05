# Immutable identity snapshots on financial records

Financial records retain both the stable user ID and immutable display snapshots for every human identity they expose: expense payer, split participant, settlement sender and recipient, and claim submitter or reviewer. A profile rename or email change affects future records only; existing history remains readable as it was recorded.

The alternative — storing only user IDs and resolving the current profile at read time — makes historical explanations mutable and can leave old records unreadable after a tombstone or account cleanup. Deleting or anonymizing the user row would be even worse because it removes the identity needed to understand prior balances.

The trade-off is denormalized identity data and the need to define a controlled privacy-redaction migration if one is ever required. For an auditable expense ledger, stable historical readability is more important than avoiding a few snapshot columns.
