# Idempotent Group and Organization creation

Creating a Vault Group and its linked Better Auth Organization is one server-owned, idempotent product operation. Vault creates the Organization, creates the Group with its Organization ID, and reports success only after both records exist. If the Group creation fails after the Organization succeeds, Vault attempts compensating deletion of the newly created Organization. Retries reconcile the original operation instead of creating duplicates.

The alternative — allowing temporary orphan Organizations or Groups and repairing them later — violates the invariant that every Group has exactly one membership container and makes invitation routing ambiguous. The two records cannot share one database transaction through the Better Auth client boundary, so explicit compensation and retry reconciliation are required.

The trade-off is a small amount of failure-recovery infrastructure and the possibility of a repair case if compensating deletion itself fails. That risk is preferable to silently creating duplicate or unlinked financial contexts.
