---
"@shivaedev/effect-sql": minor
---

### Added

- `findMany` and `select` accept model-typed `{ in: [...] }` filter entries alongside equality entries. Each list value uses its field codec, empty lists match no rows, and array field values retain equality semantics. The `FindManyFilter` type describes these query filters.
