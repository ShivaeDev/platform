---
"@shivaedev/sql": minor
"@shivaedev/contract": patch
"@shivaedev/server": patch
---

### Added

- `@shivaedev/sql`: `findById`, `findOne`, `findMany`, `select`, `count`, `aggregate` and `latestPerGroup` record the key their filter pins before they send their statement: each row when every id column is pinned by equality or `in`, otherwise a pinned `bucket` column's keys, otherwise the table. A live query built from repository reads reruns only for writes to what it filtered by and can declare `reads: () => []`.

### Changed

- `@shivaedev/contract`: A live subscription registers a recorded key only when it is not registered yet, so a handler that reads the same row many times registers its key once.
- `@shivaedev/contract`: Reads made by a module query's read policy record no keys, so a write to a row only the policy reads does not rerun the query.
- `@shivaedev/server`: Reads made by a query's read policy during a live rerun record no keys, for queries served by hand-written handlers too.
