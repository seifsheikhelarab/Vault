# No self-approval for Adjustments

The User who creates an Adjustment request cannot approve or reject that request, even when they are the Group owner or admin. Another eligible owner/admin must review it. If no other eligible reviewer exists, the request remains pending until one exists or the requester cancels it. The requester may not make the pending request financially effective by approving it themselves.

The alternative — allowing an owner/admin to self-approve — collapses correction authority and review authority and makes the approval workflow ceremonial. Restricting review to another eligible administrator preserves independent accountability.

The trade-off is that a Group with only one eligible administrator can accumulate a pending request until another administrator is added. That is preferable to weakening the review invariant; the UI should explain the blocked state and offer cancellation or member-management guidance.
