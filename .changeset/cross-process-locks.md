---
"@shivaedev/test-sql": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/test-sql`: Wait for a named advisory lock held by another process with `waitForHeldLock`, or sessions blocked behind a backend with `waitForBlockedSessions`, using bounded PostgreSQL catalog observations.

### Fixed

- `@shivaedev/create-app`: Generated starter deployment stories wait for blocked PostgreSQL sessions through test-sql's catalog observations.
