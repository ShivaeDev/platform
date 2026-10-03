# Changelog

## Unreleased

### Changed

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

## 0.1.0 - 2026-09-26

### Added

- Add native Effect model repositories with schema-derived equality filters,
  selected result decoding, ordering and limits.
- Treat `undefined` filter values as unconstrained and fail with `SchemaError`
  for field names outside the model.
- Add `transact` and `invalidateOnCommit`, built on `@shivaedev/effect-changes`:
  native transactions with mapped SQL errors and Reactivity invalidation only
  after the outermost commit.
- Keep one invalidation set per `SqlClient`: `invalidateOnCommit` marks the set
  of its own `SqlClient`, a transaction on another database nested inside
  `transact` announces its own commit, and a `transact` re-entered on a database
  with an open outer transaction joins it as a savepoint.
- Die when `invalidateOnCommit` runs after its transaction finished instead of
  dropping the keys, and when `transact` or `invalidateOnCommit` runs inside a
  native transaction that `transact` did not begin.
- Log an invalidation that fails after `COMMIT`, for example a Reactivity
  subscriber that throws, as an error and return the committed result, so
  callers do not retry writes that already landed. The same applies to
  `invalidateOnCommit` outside a transaction.
- Announce the keys when a caller is interrupted while `COMMIT` is in flight and
  the database committed.
- Add `migratePostgres`: run Effect SQL migrations under a transaction-scoped
  advisory lock with a required `lockTimeout`. An infinite `lockTimeout` becomes
  PostgreSQL's `lock_timeout = 0` (no timeout).
