---
"@shivaedev/effect-sql": minor
---

### Added

- PostgreSQL repository upserts accept a typed `updateWhere` filter, including `excluded` column comparisons, and return inserted, updated or unchanged outcomes. Conditional `upsertMany` returns one outcome per input in a single transaction, preventing stale sync revisions from overwriting newer rows.
