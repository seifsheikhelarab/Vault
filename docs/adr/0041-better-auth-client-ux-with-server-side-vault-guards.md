# Better Auth client UX with server-side Vault guards

The frontend may use Better Auth Organization client methods for invitation, acceptance, and membership UX. However, server-side Better Auth hooks or plugin guards are the authoritative enforcement boundary for every mutation with financial consequences: invitations, acceptance, role changes, ownership transfer, departure, removal, and closed-Group behavior. Client calls never bypass Vault's Group kind, balance, ownership, historical-identity, or lifecycle invariants.

The alternative — routing every interaction through custom Vault endpoints — would duplicate some Better Auth client UX and invitation behavior. Allowing direct client calls without server-side guards would let authorization paths bypass financial rules. Keeping the native UX while enforcing invariants at the server preserves usability without trusting the client.

The trade-off is hook/plugin integration complexity and the need for comprehensive tests across Better Auth's direct mutation paths. The hooks must reject invalid operations consistently whether initiated from Vault's UI or another client.
