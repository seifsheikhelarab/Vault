# Former Members retain participation history

A former Group Member retains read-only access to the historical records they participated in, including the identity snapshots and balance context needed to explain their past activity. They cannot see activity recorded after departure, create Expenses, settle, submit new corrections, or perform membership mutations. Closed Groups remain readable to former participants.

The alternatives — revoking all access or exposing the entire Group history — either prevents a person from understanding their own financial history or exposes unrelated participants' records after departure. Limiting access to participated history balances auditability with least privilege.

The trade-off is that the read model must filter historical records by participation and preserve access metadata after Better Auth membership ends. Mutation authorization must remain strictly tied to active membership and Group state.
