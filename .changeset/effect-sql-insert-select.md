---
"@shivaedev/effect-sql": minor
---

### Added

- Repositories expose `select`, `insertFromSelect` and `insertFromSelectOrIgnore` to copy filtered projections into mapped target columns with compile-time name and type checks, Schema-decoded returned rows and transaction rollback. `RepositorySelect`, `InsertFromSelect` and `SelectWrites` describe the new query and write shapes; `makeInsertFromSelect` and `makeConflictClause` build their native SQL fragments.
