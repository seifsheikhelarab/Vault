# Unified immutable Audit Event stream

Vault records every consequential financial, membership, role, ownership, and Group-lifecycle action in one immutable Audit Event stream. Each event stores the actor identity snapshot, action type, Group, target record, timestamp, reason when applicable, and before/after references where applicable. Financial records remain the source of truth; the audit stream explains who changed what and why.

The alternative — embedding history separately in each record type — produces inconsistent audit shapes and makes cross-cutting timelines difficult to query. Keeping governance history only in Better Auth also leaves financial readers without a unified explanation of membership and authorization changes.

The trade-off is an additional append-only event table and careful visibility filtering. Active members see relevant shared events, former members see events involving their participation, and owners/admins see governance events. Audit events must never be edited or deleted as part of ordinary product behavior.
