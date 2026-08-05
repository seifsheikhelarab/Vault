# Owner-controlled Group roles

The Better Auth Organization creator is the initial owner. Only the owner may promote or demote members and admins, transfer ownership through an explicit audit event, or close the Group and its linked Organization. Admins may manage invitations and removals subject to zero-balance and closed-state guards, but cannot escalate roles or transfer ownership. There is exactly one owner.

The alternative — allowing any admin to grant admin privileges — permits privilege escalation and makes destructive authority difficult to audit. Disallowing all role changes makes ordinary Group administration unnecessarily dependent on the creator.

The trade-off is a single-owner control point and the need for an explicit ownership-transfer operation if the owner leaves or becomes inactive. That constraint keeps authorization understandable and prevents admin-level privilege escalation.
