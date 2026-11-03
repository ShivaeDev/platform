---
"@shivaedev/sql": minor
---

### Added

- Declare raw SQL writers' table, record and bucket keys once with `changes(covers)` from `@shivaedev/sql/changes.ts`. Record the declaration with `record()` and pass it directly to `withChangeCoverage` to check announcements against PostgreSQL writes.
- Keep a recording local with the typed `{ publication: "local" }` option on `record()` or `invalidateOnCommit`. Local readers refresh after commit without cross-process publication; rollback discards the recording. Shared recordings in the same transaction still publish.
