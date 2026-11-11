---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/changes`: Tuple bucket keys are typed `CompositeBucketKey`, and item keys built from a `compositeId` are typed `CompositeItemKey`; `compositeId` returns the branded `CompositeId`. Both keys carry a runtime mark that `isComposite(key)` reads. Their key strings are unchanged.
- `@shivaedev/sql`: `readSql` from `@shivaedev/sql/readSql.ts` is a tagged template for raw SQL reads such as joins. Interpolate a `collection()` bucket or row key where its value goes, as in `where b.shelf = ${books.bucket.shelf(shelf)}`: `readSql` binds the key's value as the parameter and records the key, as an inferred key, before it sends the statement, so a live query that declares no keys reruns only for writes in that bucket or to that row. Other interpolations behave as in `sql`. A read through `sql` still records nothing. A tuple bucket key or a composite row key spans several columns, so `readSql` refuses it: the call does not compile, and a key typed as a plain `Key` fails with `MultiColumnKeyParameter` before anything is recorded or sent.
- `@shivaedev/contract`: When a live query that declares no keys finishes a run without recording one, the host logs a warning naming the query and saying to mark its raw reads or declare `reads`. The subscription continues; `reads: () => []` states that a query reads nothing and logs no warning.
