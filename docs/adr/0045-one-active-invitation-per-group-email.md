# One active Invitation per Group and email

A Group may have at most one active pending Better Auth Invitation for a given email address. Resending invalidates the previous pending invitation and creates a fresh invitation with a new expiry and token. If the email already belongs to an active Member, inviting it is rejected as a conflict.

The alternatives — rejecting resends or allowing duplicate invitations — either make reminders awkward or create multiple acceptance paths with ambiguous expiry and status. Replacing on resend keeps the invitation state singular while preserving the existing Better Auth lifecycle.

The trade-off is that the previous invitation token becomes invalid when a resend occurs. The UI should make the replacement explicit and show a resend confirmation rather than creating duplicate pending records.
