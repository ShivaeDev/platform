---
"@shivaedev/sql": minor
"@shivaedev/events": patch
"@shivaedev/test-sql": patch
"@shivaedev/test-kits": patch
---

### Added

- `@shivaedev/sql`: `transact` accepts no options: `transact(effect)` and `effect.pipe(transact())` keep a `SqlError` from the body or the `COMMIT` in the error channel unchanged. Pass `transact({ onSqlError })` only to map it, for example with `mapSqlError`.

### Changed

- `@shivaedev/events`: appends, catch-up and rebuild call `transact` without an identity `onSqlError` and need the `@shivaedev/sql` release that allows it; their behavior is unchanged.
- `@shivaedev/test-sql`: `withTestTransaction` and `raceWithLock` call `transact` without an identity `onSqlError` and need the `@shivaedev/sql` release that allows it; their behavior is unchanged.
- `@shivaedev/test-kits`: the SQL change-coverage check calls `transact` without an identity `onSqlError` and needs the `@shivaedev/sql` release that allows it; its behavior is unchanged.
