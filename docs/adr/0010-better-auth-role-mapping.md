# Preserve Better Auth owner and admin roles

Vault preserves Better Auth's `owner`, `admin`, and `member` roles. `owner` and `admin` both receive Vault admin capabilities such as inviting members and managing roles; `member` receives member capabilities. Only the `owner` may delete the Group and its linked Organization. All removal and departure operations remain subject to Vault's zero-balance rule.

The alternative — collapsing owner and admin everywhere — erases the distinction needed to protect destructive organization operations. Treating admins as ordinary members would make the existing organization-management model misleading and require a second custom permission system. Preserving the native roles keeps identity and authorization aligned while exposing a simple admin/member capability boundary to the financial UI.

The trade-off is that the financial layer must understand the owner/admin distinction for destructive actions, even though both roles share most day-to-day capabilities.
