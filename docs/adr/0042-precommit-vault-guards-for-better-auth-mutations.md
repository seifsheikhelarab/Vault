# Pre-commit Vault guards for Better Auth mutations

Better Auth operations that affect an active financial Group use pre-commit Vault guards. If Group kind, closed state, ownership, balance, historical-identity, or other financial validation fails, the Better Auth mutation aborts atomically and no Member, invitation, role, ownership, or departure change is persisted. Compensating cleanup is reserved for unexpected infrastructure failure, not normal business-rule enforcement.

The alternative — allowing Better Auth to commit and cleaning up afterward — creates transient invalid financial states and can expose balances or permissions that should never have existed. Best-effort reconciliation is even weaker because it makes correctness depend on a later repair task.

The trade-off is that Better Auth hook/plugin integration must participate in the write boundary and failures must be surfaced clearly to the client. This is necessary because native client methods remain supported while Vault's financial invariants remain authoritative.
