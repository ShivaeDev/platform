---
"@shivaedev/sql": minor
---

### Added

- `mapSqlError` maps named unique, foreign-key and check violations to application errors and all other SQL failures to a supplied fallback. Use the mapper with `transact`'s `onSqlError` or `Effect.mapError`.

### Breaking

- `upsert` returns `{ row, inserted }` and `upsertMany` returns an array of these results. Read the decoded model from `result.row` instead of the result itself, or destructure `{ row }`. Conditional upserts keep their tags and add `inserted: true` or `false` wherever they return a row; `Unchanged` still has no row.
