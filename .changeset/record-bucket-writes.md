---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
---

### Added

- Mark model fields with `bucket(schema)` from `@shivaedev/changes/buckets.ts`. SQL repositories announce each written record and its old and new buckets after commit, including inserts, deletes, void writes and conflict writes. Bucket codecs decode stored values before building query keys; absent values have no bucket. Bucket writes require PostgreSQL 18 or later for atomic old-row observations.

### Breaking

- `withChangeCoverage` now requires every declared record and bucket key, and a table name alone no longer covers a raw write. Migrate `covers` values from strings to typed item and bucket keys, and record `invalidationKeys(changedKeys)` through `invalidateOnCommit`. Repository writes declare their own keys automatically; raw writers declare all affected records and buckets.
- Bulk repository writes retain every record key instead of replacing them with `<table>:*` above 1,000 rows. Consumers observing raw notifications should handle the complete key set, which can span several NOTIFY payloads.
- Direct callers of the repository implementation helpers must pass a `RepositoryChanges` boundary to `makeCompositeCrud`; `versionedStatements` no longer returns `returningKeys`. Use the boundary's `returning()` fragment so void writes retain the row's bucket fields.
