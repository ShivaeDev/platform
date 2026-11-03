---
"@shivaedev/quality": minor
"@shivaedev/sql": patch
---

### Added

- `@shivaedev/quality`: Report native `sql.withTransaction` around repository writes or change announcements with `effect/sql-transact`, directing callers to begin the outer transaction with `transact(effect, { onSqlError })` before the unsupported composition runs. Native read-only and raw SQL transactions remain supported.

### Fixed

- `@shivaedev/sql`: Document the Quality check and the supported `transact` repair for repository writes inside native transactions.
