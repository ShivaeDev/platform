---
"@shivaedev/effect-sql": minor
---

### Added

- `makeRepository` accepts `conflictWhere` alongside `conflictColumns` to target partial unique indexes for `insertOrIgnore`, `insertManyOrIgnore`, `upsert` and `upsertMany`. Predicates use the existing typed equality filter, encode decoded field values and bind parameters; unmatched indexes fail with native `SqlError`.
- `repositoryFilter.ts` exports the shared `RepositoryFilter` type and `makeFilter` builder used by query and conflict predicates.
