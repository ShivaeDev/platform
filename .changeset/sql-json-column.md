---
"@shivaedev/sql": minor
---

### Added

- `json(schema)` from `@shivaedev/sql/json.ts` is the storage codec for a PostgreSQL `json` column, beside `jsonb`. It binds native `PgTypes.json` parameters and treats the value schema, invalid data and null as `jsonb` does. An object's keys read back in the order they were written, where `jsonb` returns them reordered. It keeps key order, not bytes: the value passes through `JSON.stringify` and `JSON.parse`, JavaScript puts integer-like keys first, a `Schema.Struct` value schema writes keys in schema order, and an equality filter on a `json` field fails with `SqlError` because PostgreSQL has no `json` equality operator. Store the serialized text in a `text` column for exact bytes.
