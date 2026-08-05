# Seven-day Group Invitation expiry

A pending Better Auth Invitation to a Vault Group remains valid for seven days. Resending invalidates the previous invitation and resets the seven-day window with a fresh token. An expired invitation remains visible as history but creates no Member and has no financial effect. Closing a Group cancels all pending invitations immediately, regardless of their remaining time.

The alternatives — a 24-hour window or a 30-day window — are respectively too restrictive for ordinary onboarding or too permissive for stale access requests. Seven days provides a clear, finite lifecycle while allowing normal collaborators time to respond.

The trade-off is that a recipient who misses the window needs a resend. This is preferable to leaving invitation tokens active indefinitely and is consistent with the one-active-invitation-per-email rule.
