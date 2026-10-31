---
"@shivaedev/admin": minor
"@shivaedev/create-app": minor
---

### Added

- Provide `SessionsPage` and `SessionsView` using identity's session administration calls and permission, with session timestamps, an own-session marker and inline revoke confirmation. Applications supply the current session id and sign-out callback.
- Generated starters mount the Sessions admin page and sign out after revoking the current session.
