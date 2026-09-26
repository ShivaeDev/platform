# Changelog

## 0.2.0 - 2026-09-26

### Added

- `tableWrites(client)` reads the current transaction's per-table write counts
  as a baseline for `writtenTables`.

### Fixed

- `writtenTables` reported tables that earlier transactions wrote on the same
  pooled connection, because PostgreSQL keeps `pg_stat_xact_user_tables`
  counters per connection until it flushes them. Take a baseline with
  `tableWrites` when the test transaction starts and pass it as
  `writtenTables(client, since)` to report only the tables written after it.
  A `TRUNCATE` inside the test transaction resets its counts to the baseline,
  so `writtenTables` does not see it.

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
