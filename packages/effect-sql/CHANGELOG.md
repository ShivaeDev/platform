# Changelog

## 0.5.0 - 2026-10-17

### Added

- Unversioned repositories expose `insertMany(inputs)`. Repositories declaring `conflictColumns` also expose `insertManyOrIgnore(inputs)` and `upsertMany(inputs, { updateColumns })`, with model-derived insert inputs, decoded model arrays, bounded SQL chunks and caller-owned native transactions. Empty batches return an empty array without writing.

## 0.4.0 - 2026-10-16

### Added

- `makeRepository` accepts a composite `idColumn` tuple; `findById` and `delete` accept the full key object, and updates match every key column through the model's codecs.
- Unversioned repositories with declared `conflictColumns` expose `insertOrIgnore(input)` returning an optional decoded model and `upsert(input, { updateColumns })` returning the inserted or updated model. Inputs use the model's insert schema, selected update columns exclude primary and conflict keys, and writes participate in native transactions. PostgreSQL tests cover these paths.

## 0.3.0 - 2026-10-13

### Changed

- A failed `COMMIT` inside `transact` fails with a typed `SqlError` mapped through `onSqlError` instead of a defect.

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/sql-pg` 4.0.4 alongside it, whose native PostgreSQL client replaces `pg`.
- `PostgresChangeClient.listen` returns a scoped `Queue` of notifications, matching `PgClient.listen` in `@effect/sql-pg` 4.0.4.
- JSON and JSONB columns are not supported. A repository write of a plain object to one fails with `SqlError`; give structured data its own columns or table.
- PostgreSQL `int8` values read as `bigint` (use `Schema.BigInt`), `date` values read as `YYYY-MM-DD` strings, and `timestamp without time zone` values are read and written as UTC wall time.

## 0.2.1 - 2026-10-12

### Added

- Repositories accept an optional `versionColumn`: inserts initialize it to zero, updates match the expected version and increment it atomically, and deletes require the expected version. Stale or missing rows fail with typed `OptimisticConcurrencyError`; returned updated models carry the new version. PostgreSQL tests cover concurrent writers, versioned deletion and void writes. Unversioned repositories retain native CRUD behavior.
- `postgresChanges` in `postgresChanges.ts` binds `transact` to PostgreSQL LISTEN/NOTIFY using the writing transaction's SQL client. Each process delivers committed string or finite-number invalidation keys into local Reactivity. Rollback sends no notification.
- The scoped listener uses a heartbeat to detect silent connection loss, resyncs live streams before cleanup on loss and again on recovery, and retries with a fresh subscription. Each native listener finalizer is bounded by `heartbeatTimeout`, so a stalled UNLISTEN does not block connection release, retry or process scope shutdown. UTF-8 payloads are split below PostgreSQL's 8,000-byte NOTIFY limit; an oversized individual key or unsupported key rolls back the transaction.
- `BeforeCommit` and `CommittedSink` in `transact.ts` expose the SQL channel's binding seams.

### Changed

- Give the package an agent north star, a model-to-query usage guide, and dedicated north-star and roadmap docs; publish `docs/` alongside the README while keeping agent instructions out of npm.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-sql`: `@shivaedev/effect-sql/repository.ts` (`FindMany`, `makeRepository`), `@shivaedev/effect-sql/transact.ts` (`InvalidationKeys`, `TransactOptions`, `invalidateOnCommit`, `transact`), `@shivaedev/effect-sql/migrations.ts` (`PostgresMigrationOptions`, `migratePostgres`)
- `makeRepository` and `FindMany` moved out of the deleted entry file into `repository.ts`.

## 0.1.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

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
