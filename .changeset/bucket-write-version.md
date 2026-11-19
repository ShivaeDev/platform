---
"@shivaedev/sql": minor
---

### Breaking

- `@shivaedev/sql`: Building a repository whose model has single-column or tuple buckets on a PostgreSQL client reads the server version once and, when the server reports a version before 18, fails with `BucketWriteVersionError` from `@shivaedev/sql/bucketWriteVersion.ts` before any write. Its message names the table, the version found, the required version 18 and why: bucketed writes read each row's previous bucket with `RETURNING old`. `makeRepository` and `makeOrderedChildren` now also fail with `SqlError` or `Schema.SchemaError` when that version read fails. Code that states `makeRepository`'s error type as `BucketRegistrationError` widens it to `RepositoryRegistrationError` from `@shivaedev/sql/repositoryCollection.ts`, the union `BucketRegistrationError | BucketWriteVersionError | SqlError | Schema.SchemaError`; an application on PostgreSQL 16 or 17 upgrades its database to PostgreSQL 18 before using bucketed repositories. A repository without buckets registers on an older server as before.
