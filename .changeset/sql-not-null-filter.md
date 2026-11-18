---
"@shivaedev/sql": minor
---

### Added

- `findMany`, `count`, `select` and `aggregate` filters take `{ not: null }` on a field whose type admits null and match the rows that hold a value, as SQL `IS NOT NULL`: `findMany({ where: { finishedAt: { not: null } } })`. The types refuse it on a field that cannot be null, and such a filter fails with `SchemaError` at run time. A JSONB field whose schema accepts `{ not: null }` still compares it as a JSON value, `delete` and `latestPerGroup` keep their equality and list filters, and a live read filtered this way listens on the table.
