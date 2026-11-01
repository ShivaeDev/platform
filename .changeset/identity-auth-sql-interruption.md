---
"@shivaedev/identity": patch
---

### Fixed

- Interrupting a session lookup, provider-account lookup or mounted Better Auth request cancels its pending PostgreSQL query. Transaction commit, rollback and connection cleanup still finish after cancellation.
