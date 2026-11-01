---
"@shivaedev/sql": patch
---

### Fixed

- Match SQL NULL for null equality filters on JSONB fields in reads, counts and deletes. Values accepted by the column schema compare through its codec before filter operators are considered, including JSON objects with `gt` or `in` keys.
