# Invitation acceptance activates Group membership

Accepting a Better Auth Organization invitation automatically activates the recipient's financial membership in the linked Vault Group. There is no second Vault join step and no separate admin confirmation. The pre-commit guard resolves the Organization to its Group and rejects acceptance if the Group is missing, invalid, or permanently closed.

The alternatives — requiring a second join action or an admin approval — duplicate Better Auth's invitation lifecycle and create a window where identity membership and financial membership disagree. Automatic activation keeps the Organization's Member record as the sole active membership source and makes acceptance semantics predictable for invited non-users.

The trade-off is that invitation acceptance immediately grants financial participation, so the pre-commit guard and Group-to-Organization link must be reliable. Pending invitations remain outside balances and permissions until acceptance succeeds.
