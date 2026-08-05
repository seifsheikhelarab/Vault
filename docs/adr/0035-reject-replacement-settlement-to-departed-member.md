# Reject replacement Settlements to departed members

When a partial Settlement repair requires a replacement payment to a member who has since departed, Vault rejects the replacement. It may still record the exact inverse of the original Settlement, subject to the correction workflow, but it does not create a new normal Settlement to an inactive identity.

The alternatives — allowing a special historical payment or an admin override — create a new financial event for an inactive identity and weaken the active-membership rule. Historical identity remains valid for explaining and reversing old payments, but not for creating new payment obligations.

The trade-off is that some real-world partial corrections cannot be fully represented after a counterparty departs. This is preferable to silently extending the active financial lifecycle of an inactive member; the UI must explain that only the exact reversal is available.
