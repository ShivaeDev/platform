---
"@shivaedev/identity": patch
---

### Fixed

- Interrupting a session lookup, provider-account lookup or mounted Better Auth request cancels its pending PostgreSQL query. Transaction commit, rollback and connection cleanup still finish after cancellation.
- Present SQL interruption to Better Auth as a cancelled request so an interrupted session lookup does not log an internal server error.
