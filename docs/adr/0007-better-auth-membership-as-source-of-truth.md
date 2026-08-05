# Better Auth Membership as the source of truth

Better Auth Organization `Member` records are the sole source of active Group membership. Vault does not maintain a duplicate domain Membership table or projection. Better Auth owns invitation acceptance, active membership identity, and roles; Vault reads those records when determining who may participate in expenses and balances.

The alternative — retaining a custom Membership projection — duplicates identity and role state and creates synchronization risks when invitations are accepted or members are changed through Better Auth. Using Better Auth directly keeps one authoritative membership model and reuses the invitation lifecycle already implemented.

Vault-specific financial rules still apply at the domain boundary. In particular, leaving or removing a member must be prevented while their derived Group balance is non-zero, and all guarded membership operations must preserve historical user identity in Expenses, Splits, Settlements, and balance history. The trade-off is tighter coupling between the financial domain and Better Auth's Organization schema and the need to ensure all membership mutation paths pass through Vault's financial guard.
