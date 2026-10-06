# Changelog

## Unreleased

### Changed

- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.4.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-changes-prisma`: `@shivaedev/effect-changes-prisma/changes.ts` (`makePrismaChanges`, `PrismaChanges`, `PrismaChangesOptions`, `UnnamedObserver`), `@shivaedev/effect-changes-prisma/coverage.ts` (`Coverage`, `CoverageViolation`, `checkCoverage`), `@shivaedev/effect-changes-prisma/error.ts` (`PrismaError`, `TransactionExpired`), `@shivaedev/effect-changes-prisma/model.ts` (`ChangeMap`, `CountOperation`, `ModelChanges`, `ModelName`, `ModelRow`, `RowOperation`, `Transactional`, `TransactionOptions`), `@shivaedev/effect-changes-prisma/tables.ts` (`RawQueryClient`, `TableWrites`, `tablesOf`, `tableWrites`, `writtenTables`), `@shivaedev/effect-changes-prisma/write.ts` (`UnnamedWrite`, `Write`)
- Expose test fixture generation through `test:prepare` so workspace test shards generate the Prisma client before collection.

## 0.3.3 - 2026-10-04

### Changed

- The tests import the Prisma client they generate through the `#test/*` alias.

## 0.3.2 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

## 0.3.1 - 2026-10-04

### Changed

- The README and the package description say plainly that the package works with PostgreSQL only.

## 0.3.0 - 2026-10-04

### Changed

- Validate packed consumers and executable bins through the shared workspace gate.
- `TransactionOptions.isolationLevel` takes only `"ReadUncommitted"`, `"ReadCommitted"`, `"RepeatableRead"` or `"Serializable"`, the levels Prisma accepts on PostgreSQL, instead of any string. `Transactional.$transaction` is declared as a property, so a client is checked strictly against it. The package now depends on `@shivaedev/types` for `Bivariant`, which keeps the change functions of a model map bivariant.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax, so classes declare their fields instead of using constructor parameter properties.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.2.1 - 2026-09-28

### Changed

- Pin the `@prisma/client` peer dependency to exactly 7.10.0, the version the
  package is now tested against, instead of 7.9.1.

## 0.2.0 - 2026-09-26

### Added

- `tableWrites(client)` reads the current transaction's per-table write counts
  as a baseline for `writtenTables`.

### Changed

- **Breaking:** `transaction` can fail with the new `TransactionExpired`, so its
  error type is now `E | TransactionExpired | PrismaError`. A transaction that
  outlives its timeout, and a savepoint start, `RELEASE` or `COMMIT` that
  Prisma refuses with `P2028` because the transaction is closed, used to fail
  with `PrismaError` and now fail with `TransactionExpired`. A transaction that
  cannot start at all, such as one waiting past `maxWait` for a connection,
  still fails with `PrismaError`, although Prisma also reports it as `P2028`.
  Migrate by adding `TransactionExpired` wherever the error type is written
  out: `Effect.Effect<A, PrismaError>` becomes
  `Effect.Effect<A, TransactionExpired | PrismaError>`.

### Fixed

- `writtenTables` reported tables that earlier transactions wrote on the same
  pooled connection, because PostgreSQL keeps `pg_stat_xact_user_tables`
  counters per connection until it flushes them. Take a baseline with
  `tableWrites` when the test transaction starts and pass it as
  `writtenTables(client, since)` to report only the tables written after it.
  A `TRUNCATE` inside the test transaction resets its counts to the baseline,
  so `writtenTables` does not see it.
- A `transaction` body kept running after Prisma expired the transaction,
  keeping the caller waiting and free to make HTTP calls or publish while its
  queries were refused. The body is now interrupted when the transaction's
  timeout passes, or when one of its queries or nested `transaction`s fails
  with `P2028` because the transaction is closed. The call then fails with
  `TransactionExpired`, and nothing publishes. The timeout is the `timeout`
  option, else the `transactionOptions.timeout` Prisma applies to the current
  client, extended or not, 5 seconds unless the client sets another. It is
  timed from the start of the transaction on the wall clock. When the client's
  timeout cannot be read, `transaction` sets no deadline of its own, and the
  body stops at its first query after Prisma closes the transaction. A
  `transaction` on a transaction client is a savepoint and has no timeout of
  its own; on any other client it is a separate transaction whose expiry does
  not stop the body it runs in.
- Two copies of the package with bindings of the same name shared their
  `Client` and expiry signal. Each binding is now keyed by a random id.

## 0.1.1 - 2026-09-26

### Changed

- Pin the `@prisma/client` peer dependency to exactly 7.9.1, the version the
  package is tested against, instead of `^7.9.1`.

## 0.1.0 - 2026-09-26

### Added

- Add `makePrismaChanges`: bind a `@shivaedev/effect-changes` channel to a
  Prisma Classic client with interactive `$transaction`, with the base client
  as the channel's owner.
- Run `transaction(body)` inside `$transaction` with the frame opened through
  `open` and settled from `$transaction`'s outcome: changes publish once after
  `COMMIT`, a failing body or a failed or timed-out commit discards them, and a
  nested `transaction` becomes a savepoint that merges on release. A caller
  interrupted during the body rolls back; one interrupted while `COMMIT` is in
  flight still publishes when the commit lands.
- Record writes automatically through `use(query)` from a typed model map,
  `ChangeMap`, that turns each returned row into any number of changes and can
  be made exhaustive over the client's models with `satisfies`. Writes outside a
  transaction publish when they autocommit.
- Report count-only `createMany`, `updateMany` and `deleteMany` writes on mapped
  models, and writes whose `select` or `omit` dropped a field the map reads, to
  the `Unnamed` test seam instead of recording them.
- Add `recordWrite` for applications that already wrap Prisma in their own
  Effect client.
- Add the coverage check: `writtenTables` reads `pg_stat_xact_user_tables` on a
  test transaction, `tablesOf` maps tables to models from Prisma schema text,
  and `checkCoverage` returns the tables written without a covering recorded
  change and every unnamed write.
