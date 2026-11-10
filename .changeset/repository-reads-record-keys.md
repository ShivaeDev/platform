---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
"@shivaedev/contract": minor
"@shivaedev/server": patch
---

### Added

- `@shivaedev/changes`: `recordRead(keys, { inferred: true })` marks keys a library worked out from a read's arguments; a live subscription uses them only for a query that declares no keys.
- `@shivaedev/sql`: `findById`, `findOne`, `findMany`, `select`, `count`, `aggregate` and `latestPerGroup` record, as inferred keys, the key their filter pins before they send their statement: each row when every id column is pinned by equality or `in`, otherwise a pinned `bucket` column's keys, otherwise the table.
- `@shivaedev/contract`: A query may leave out `reads`. A query that declares no keys in `reads`, `serverReads` or `readsCollections` listens on what its repository reads pin, so an unfiltered read listens on the whole table; declared keys are used exactly as declared, so existing queries listen as before.
- `@shivaedev/contract`: A live subscription registers a recorded key only when it is not registered yet, so a handler that reads the same row many times registers its key once.
- `@shivaedev/contract`: Reads made by a module query's read policy record no keys, so a write to a row only the policy reads does not rerun the query.

### Fixed

- `@shivaedev/server`: Reads made by a query's read policy during a live rerun record no keys, for queries served by hand-written handlers too.
