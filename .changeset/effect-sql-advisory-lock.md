---
"@shivaedev/effect-sql": minor
---

### Added

- `advisoryXactLock(key: bigint | string)` takes a PostgreSQL transaction-scoped advisory lock inside `transact`, with string keys hashed by `hashtextextended(key, 0)`. `AdvisoryLockOutsideTransaction` is the typed failure when no transaction is active. `migratePostgres` uses the same lock function.
