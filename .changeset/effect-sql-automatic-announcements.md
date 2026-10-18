---
"@shivaedev/effect-sql": minor
---

### Added

- Repository insert, update, delete, conflict and batch writes record the table key and returned row item keys through the existing commit channel, including generated IDs and void writes. Transactions deduplicate keys and discard rolled-back writes.
- PostgreSQL migration batches own the same commit boundary, so repository seed and upgrade writes announce after the batch commits.
- Low-level composition exposes `repositoryChanges(sql, table, columns)`, `RepositoryChanges`, and `repositoryWrites(model, sql, options, changes)`.
- `testing.ts` exports `withChangeCoverage(body)` and `UnannouncedWrites`; PostgreSQL transaction statistics catch tables written without a recorded table key. `transact.ts` exports `ChangeObserver` for observing that channel.

### Breaking

- Repository writes now open their own `transact` boundary. Use `transact` for an enclosing transaction instead of bare `sql.withTransaction`, and remove explicit invalidations for repository table/item keys. Keep explicit invalidations for derived keys. Standalone batch calls now roll back all chunks together. Direct callers of `makeInsertMany`, `makeConflictWrites` or `makeVersionedWrites` must supply `options.changes` from `repositoryChanges`, or use `makeRepository`.
