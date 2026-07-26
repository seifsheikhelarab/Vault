# Unified Group model for social and department contexts

Social Groups (trips, households) and Departments (teams with budgets and approval) are the same entity — `Group` with a `kind` field (`social` or `department`) — rather than two separate models.

Both are named collections of users with shared expenses and membership. The behavioral differences (splits vs budgets, peer settlement vs approval workflow) are driven by the `kind` field and the presence of extension records (Split for social, Claim for department), not by structural differences in the container itself.

This avoids duplicating membership logic, expense routing, and balance calculation. The cost is that social and department code paths share a table, but since behavior is determined by extensions (Split/Claim), the shared surface is minimal.
