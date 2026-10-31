---
"@shivaedev/sql": minor
---

### Breaking

- `tupleIn(model, fields, tuples, types)` now requires a PostgreSQL scalar type map as its fourth argument. Migrate `tupleIn(Row, ["name", "attempt"], tuples)` to `tupleIn(Row, ["name", "attempt"], tuples, { name: "text", attempt: "int4" })`, choosing the actual stored column types, including `text` for numbers stored as text. Use the scalar names in `PgTypes.OID` (for example, `int4` for integer and `int8` for bigint); array-valued and custom PostgreSQL types use explicit native SQL.

### Fixed

- PostgreSQL tuple filters bind one array per column and match through `unnest`, keeping parameter counts constant for large reads, prepared selects, deletes and tuple-pinned grouped lookups. Field codecs, empty lists, null equality and duplicate tuple results retain their semantics.
