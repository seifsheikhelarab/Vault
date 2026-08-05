# Owner must transfer ownership before departure

A Group owner must explicitly transfer ownership to another active admin before leaving the Group, tombstoning their account, or relinquishing control. The transfer is an auditable event, and the Group cannot become ownerless. Ownership cannot be transferred to a pending invitee, departed member, or ordinary member without first making that person an active admin through the owner-controlled role flow.

The alternatives — automatically promoting an admin or requiring the owner to close the Group — either hide a consequential authority change or destroy a potentially active financial context. Explicit transfer keeps the outgoing owner's intent visible and preserves a clear authorization chain.

The trade-off is that an owner who cannot identify an eligible successor cannot leave without first resolving Group governance. That is preferable to an ownerless Group whose invitations, role changes, and closure operations have no authoritative actor.
