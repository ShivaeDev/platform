---
"@shivaedev/sql": minor
"@shivaedev/events": patch
"@shivaedev/test-sql": patch
"@shivaedev/test-kits": patch
---

### Added

- `transact` accepts no options: `transact(effect)` and `effect.pipe(transact())` keep a `SqlError` from the body or the `COMMIT` in the error channel unchanged. Pass `transact({ onSqlError })` only to map it, for example with `mapSqlError`.

### Changed

- Events, test-sql and test-kits call `transact` without an identity `onSqlError` and need the `@shivaedev/sql` release that allows it; their behavior is unchanged.
