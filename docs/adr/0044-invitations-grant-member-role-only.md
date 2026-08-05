# Invitations grant the member role only

Every Better Auth invitation to a Vault Group creates a `member` when accepted. Only the Group owner may later promote that active member to `admin` through the owner-controlled role flow. Admins may invite people but cannot grant elevated privileges through an invitation.

The alternative — letting an inviter choose `admin` — conflates invitation authority with privilege escalation and permits an admin to grant a role they are not authorized to control. Restricting invitations to `member` keeps the acceptance path simple and makes the owner-only role boundary enforceable.

The trade-off is one additional promotion step when a new administrator is needed. That is preferable to encoding privilege escalation in an invitation and ensures the existing role picker cannot bypass the owner-controlled policy.
