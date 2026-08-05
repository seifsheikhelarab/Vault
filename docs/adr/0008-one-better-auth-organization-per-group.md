# One Better Auth Organization per Group

Every Vault Group has exactly one Better Auth Organization. The domain Group stores the Organization ID as an explicit link rather than sharing the same ID value. The Organization is the Group's active membership container, and Better Auth Member records are the sole source of active membership.

The alternative — leaving social Groups unlinked or allowing multiple Organizations per Group — makes invitation acceptance ambiguous and allows financial membership to drift from identity membership. Sharing IDs would make lookup concise, but would couple two independently generated records and make migrations or recovery harder.

An explicit Organization ID preserves clear ownership boundaries while making the relationship unambiguous. Group creation and Organization creation must therefore be treated as one product operation, with failure handling for either side.
