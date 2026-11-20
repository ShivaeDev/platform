---
"@shivaedev/sql": minor
---

### Added

- A repository's `delete` and `latestPerGroup` take every filter its reads take: `{ not: null }`, the range bounds `gt`, `gte`, `lt` and `lte`, and `like`. `delete({ archivedAt: { not: null } })` removes the rows that hold a value and keeps those without one.
- `latestPerGroup` reads a partition field filtered by `{ not: null }`, a range or a pattern through its ranked query instead of failing with `SchemaError`.

### Breaking

- The `RepositoryListFilter` type is gone, because no repository method takes it any more. Use `FindManyFilter` from `@shivaedev/sql/repositoryFilter.ts`.
