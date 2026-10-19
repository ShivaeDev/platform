# Changelog

## 0.7.2 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.7.1 - 2026-10-19

### Changed

- Release with updated workspace dependencies.

## 0.7.0 - 2026-10-19

### Added

- `PostgresTestOptions` accepts effect-sql's `SqlNameTransforms`, including the options returned by `clientOptions`, for preparation, shared and isolated PostgreSQL clients. Reuse the app's client options without a test-only name mapping.
- `assertModelColumns` uses the current PostgreSQL client's name transforms to compare database columns with model fields and report mismatches in model field names. Calls without a configured mapping retain literal column comparisons.

## 0.6.1 - 2026-10-18

### Changed

- Release with updated workspace dependencies.

## 0.6.0 - 2026-10-18

### Added

- `PostgresTestDatabase.awaitCleanup`, a native `Effect<void>` that waits for already-queued drops and preserves cleanup failures as SQL defects.
- Select an empty or migrated database from one test layer with `PostgresTestDatabase.clone(template)` or `withIsolatedDatabase(effect, { template })`. `PostgresTestTemplate` names the choices; migrated clones remain the default. Story traits can choose a template before acquiring their app services.
- Accept a scoped `PostgresTestLoader` callback in `fixtures` that receives the migrated template's redacted URL, so app options can open their own pool during once-per-layer preparation. Existing fixture Effects remain supported.

### Changed

- Drop isolated databases in the background and await outstanding cleanup when the PostgreSQL test layer closes.

### Fixed

- Retry database drops when PostgreSQL's connection budget is exhausted, and sweep abandoned local test databases at startup. Retries use live time even when a test clock is paused. Permanent cleanup failures still surface as SQL defects when the layer closes.

## 0.5.5 - 2026-10-18

### Changed

- Release with updated workspace dependencies.

## 0.5.4 - 2026-10-18

### Fixed

- Align published framework dependencies with the current releases.

## 0.5.3 - 2026-10-18

### Fixed

- Close the isolated test's application scope before closing its SQL services and dropping its database.

## 0.5.2 - 2026-10-17

### Changed

- Block `@shivaedev/effect-test-sql/internal/*` imports; use the public test isolation modules instead.

## 0.5.1 - 2026-10-17

### Fixed

- The `migrateTo(name: string | number)` helper returned by `migrationSteps` accepts zero-padded migration names as written, unpadded names and bare numeric ids. Unknown or ambiguous targets fail with a typed `MigrationError` naming the requested target.

## 0.5.0 - 2026-10-17

### Added

- `migrationSteps(appMigrations)` from `migrationSteps.ts` provides `migrateTo("1_name")` and `migrateToLatest` on the current PostgreSQL client, so tests can seed old-schema rows before running a backfill. Unknown names fail with a typed `MigrationError`; loader dependencies and scope stay explicit.
- `makePostgresTestLayer({ prepare: false, ... })` skips migration and fixture preparation, giving isolated tests and test-story stories empty databases without a second migration list.

## 0.4.0 - 2026-10-17

### Added

- `PostgresTestOptions.maxConnections` configures the preparation, shared and isolated database pool limit per suite.

### Fixed

- `makePostgresTestLayer` keeps its administration connection alive until fixture cleanup, so an idle period cannot leave database finalizers waiting for a new pooled connection during scope closure.
- Test database pools default to two connections, and administrative connections close after each create or drop, so concurrent database copies use a smaller PostgreSQL connection budget. Fresh scoped administration connections preserve database cleanup after idle periods without retaining a worker-lifetime connection.
- Setup, rollback and isolated test wrappers explain PostgreSQL connection-limit failures with `max_connections` and a `vitest run --maxWorkers=4` suggestion while retaining SQLSTATE `53300`.
- Publish against `@shivaedev/effect-sql` 0.5.0 so a generated app shares the same SQL service tags as Platform.

## 0.3.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/sql-pg` 4.0.4 alongside it, whose native PostgreSQL client replaces `pg`.

## 0.2.0 - 2026-10-13

### Added

- `migrationUpgrade({ migrations, upTo, table })` applies an older migration prefix and then the latest migrations on PostgreSQL, returning live column names and exact PostgreSQL types. `assertModelColumns(columns, model, types)` checks those columns against the model's database fields and an explicit type map, failing with `ModelColumnMismatch` for missing, extra or wrongly typed columns. Upgrade checks reject populated custom ledgers before loading migrations, using the migration runner's identifier semantics.

## 0.1.0 - 2026-10-11

### Added

- `makePostgresTestLayer` prepares migrations and optional fixtures once in a PostgreSQL template and provides native services on a shared test database. `withTestTransaction` wraps harness setup, the body and scope finalizers in rollback, preserves nested `transact` savepoints, and discards commit-bound invalidations. `withIsolatedDatabase` clones the prepared template for real commits and drops the clone after the test. The Layer scope drops its shared database and template. Real PostgreSQL tests cover concurrency, row-lock release, failure and interruption, template reuse, second-connection commit visibility and resource cleanup.
