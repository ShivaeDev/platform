# Changelog

## Unreleased

### Changed

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Replace JSDoc blocks with short reason comments, so the package passes the comment rules of `@shivaedev/quality`.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax, so classes declare their fields instead of using constructor parameter properties.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.6.4 - 2026-09-26

### Changed

- Require Effect Test 0.1.2, whose `eventually` retries only typed failures.

## 0.6.3 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.
- Require Effect Test 0.1.1, which moves to the same Effect release.

## 0.6.2 - 2026-08-31

### Fixed

- Coordinate finite root SQLite query effects with explicit transaction
  lifetimes so a transaction cannot lose its WAL snapshot to an interleaved
  root write.

## 0.6.1 - 2026-08-30

### Changed

- Build `makeDatabaseIt` on `@shivaedev/effect-test` instead of a private
  Vitest runner.

### Added

- Accept `clock: "live"` on `makeDatabaseIt` and `effectDB` tests to use
  wall-clock time instead of TestClock.

## 0.6.0 - 2026-08-27

### Changed

- **Breaking:** Make Database the only public persistence service. Relations
  and Streams no longer expose an executor requirement. Transaction bodies
  yield Database, while captured Relations from that singleton resolve the
  private active transaction when executed inside the boundary.
- **Breaking:** Construct database definitions with `makeDatabase<Contract>()`
  or `makeSqliteDatabase<Contract>()` so two databases sharing one contract
  retain distinct service identities. Composition uses one unique definition
  identifier and one live Layer per definition.
- Refuse forced-rollback test transactions nested inside ordinary commit
  transactions, and fail closed when transaction-bound values escape their
  settled boundary or cross into a concurrent sibling transaction.
- Serialize SQLite transaction scopes inside the supported singleton Database
  Layer while leaving ordinary queries and writes unsynchronized.

## 0.5.3 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.

## 0.5.2 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.

## 0.5.1 - 2026-08-12

### Fixed

- `DatabaseRequirement<typeof Database>` resolved to `never` for every real
  database, so consumers annotating their own effects with it silently dropped
  the executor requirement and only found out when providing the Layer failed.
  `Context.Service` is invariant in both parameters, which meant a holder built
  for a concrete contract never matched the `AnySqlContract` pattern the
  conditional tested; the contract is now inferred alongside the requirement.

## 0.5.0 - 2026-08-12

### Added

- Experimental SQLite support through `@shivaedev/effect-prisma/sqlite`.
  `makeSqliteDatabase` owns a Prisma Next SQLite client, applies connect-time
  pragmas (`journal_mode=WAL` by default), and serves the same queries,
  implicitly scoped transactions, Streams, and always-rollback test harness as
  the PostgreSQL entrypoint. In-memory databases are rejected because
  transactions run on their own connection.
- SQLite `DateTime` values stored without a zone designator — the form
  `datetime('now')` column defaults write — now decode as UTC instead of local
  time, so generated defaults read back as the instant SQLite wrote.

## 0.4.3 - 2026-08-03

### Fixed

- Normalize PostgreSQL timestamp types emitted through Prisma Next's codec
  references to `Date`.

## 0.4.2 - 2026-08-03

### Fixed

- Provide a contract-normalization command that corrects Prisma Next's
  PostgreSQL timestamp declarations without recursively expanding large client
  types.

## 0.4.1 - 2026-08-03

### Fixed

- Expose PostgreSQL timestamp and timestamp-with-time-zone fields as `Date`,
  matching Prisma Next's runtime codecs even when its generated contract renders
  those fields as branded strings.

## 0.4.0 - 2026-08-03

### Added

- Export database definition helpers and Prisma Next boolean filter
  combinators for higher-level integrations.

## 0.3.0 - 2026-08-03

### Added

- Export database service and requirement types from the testing entrypoint for
  higher-level test harnesses.

### Changed

- Serialize queries sharing a transaction connection, and buffer
  transaction-scoped Streams before downstream processing. Queries and Streams
  outside transactions remain parallel and incremental.
- Target Effect 4.0.0-beta.102 across the runtime and optional Vitest helpers.

## 0.2.0 - 2026-07-26

### Added

- Load typed to-one and to-many relations, including nested and refined
  relations and relation counts.
- Count any filtered relation directly without building an aggregate result.

## 0.1.0 - 2026-07-26

### Added

- Effect-native, immutable Prisma relations with typed filtering, ordering,
  pagination, aggregates, grouping, and mutation operations.
- Implicitly scoped transactions that preserve the same database service inside
  and outside a transaction.
- Vitest helpers for typed database tests that automatically roll back their
  changes.
