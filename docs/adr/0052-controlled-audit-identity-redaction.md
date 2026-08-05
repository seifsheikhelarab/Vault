# Controlled redaction of Audit Event identity snapshots

Audit Events remain structurally and financially immutable. A controlled, separately audited privacy-redaction operation may replace personal actor snapshot fields with a canonical `Deleted user` representation. Stable user IDs, action types, Groups, targets, timestamps, amounts, relationships, and other financial facts remain intact. Identity redaction is never ordinary self-service and never deletes the Audit Event.

The alternative — never redacting personal snapshots — can conflict with privacy obligations. Deleting the event or removing all identity fields would destroy the explanation of who performed a consequential action and weaken financial auditability.

The trade-off is a specialized redaction workflow and the need to protect the redaction event itself. The resulting history preserves financial truth and event relationships while allowing a controlled removal of personal display data.
