# Authoritative Group kind

`Group.kind` is authoritative for financial behavior. A `social` Group permits Expenses with Splits, derived peer balances, Settlements, and social correction workflows. A `department` Group permits Budgets and Claims but does not permit peer Splits, balances, or Settlements. The server rejects extension records and mutations that do not match the Group kind; the UI derives available actions from the kind.

The alternative — allowing any Group to use any extension — makes the unified container ambiguous and permits a department claim workflow to accidentally enter peer debt settlement or a social group to bypass its allocation model. Treating kind as merely advisory would move a consequential invariant into UI configuration and allow inconsistent states through the API.

The trade-off is less flexibility per Group and a validation boundary that must be applied consistently across Expenses, Splits, Settlements, Budgets, Claims, and correction records. That constraint makes the domain model explainable and prevents cross-context financial semantics.
