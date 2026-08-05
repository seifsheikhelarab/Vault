# Preserve the Better Auth Organization as inert history

When a Vault Group closes, its linked Better Auth Organization and Member records are preserved for historical identity but become inert. Pending invitations are cancelled, and Vault blocks new invitations, membership changes, Expenses, Adjustments, and Settlements. Direct organization operations must not mutate a closed financial Group. The Organization is not deleted.

The alternative — deleting the Organization — would erase the authoritative identity container and force historical records to rely only on copied snapshots. Leaving it fully active would allow invitations or membership changes that contradict the closed financial context.

The trade-off is retaining an inactive Organization and enforcing the closed-state guard across every organization and financial mutation path. This preserves identity while making the Group's lifecycle unambiguous and read-only.
