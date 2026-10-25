---
"@shivaedev/effect-sql": minor
"@shivaedev/platform": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/effect-sql` exports `pendingPostgresMigrations` to read pending ledger migration IDs and names and schema component names and details.
- `@shivaedev/platform` logs migration wait start, periodic progress, completion and timeout through Effect's logger with pending migration and component annotations. `migrations.progressInterval` controls progress logging independently of polling and defaults to 30 seconds.

### Changed

- `@shivaedev/create-app`'s starter worker uses the host's migration wait logs and keeps its job readiness line.
