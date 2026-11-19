---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
---

### Added

- `@shivaedev/changes`: `SingleColumnBucketKey` and `SingleColumnItemKey` from `@shivaedev/changes/compositeKeys.ts`. A collection's single-column bucket keys and numeric-id item keys now have these types, so code that takes keys can tell they span one column. String-id item keys stay `ItemKey`, because a string spelled as `compositeId` marks the key composite at runtime.

### Fixed

- `@shivaedev/sql`: `BucketRegistrationError` now says what to change. When the collection name differs from `tableName`, it prints both names and says the collection name must equal the table name; it names the collection a repository without one needs, and it prints both bucket field lists when they differ.

### Breaking

- `@shivaedev/sql`: a `readSql` read whose interpolated keys are all single-column keys straight from their collection, bucket keys or numeric-id row keys, no longer carries `MultiColumnKeyParameter` in its error type, so a contract module query can use it without `Effect.die`. Migrate by removing any `Effect.catchTag("MultiColumnKeyParameter", ...)` or `Effect.die` handler on such a read; the compiler now rejects the `catchTag`. Reads that interpolate a key typed as a plain `Key`, `BucketKey` or `ItemKey`, including a string-id row key, keep the error.
