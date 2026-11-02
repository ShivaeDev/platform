---
"@shivaedev/sql": minor
---

### Added

- `inValues(column, values)` supplies a native SQL predicate that matches nothing for an empty list, including qualified columns in `SqlSchema` queries.
- `int8(field)` and `int4Array(field)` preserve field schemas while encoding native PostgreSQL storage parameters for bigint values and integer arrays, including empty arrays.
