---
"@shivaedev/server": patch
---

### Fixed

- Revoked bearer and cookie change subscriptions end with typed `Unauthorized` from session middleware, without racing a host-initiated socket close. Later protected calls on the shared socket reject the revoked session.
