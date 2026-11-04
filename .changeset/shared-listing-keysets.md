---
"@shivaedev/jobs": minor
"@shivaedev/sql": minor
---

### Added

- `@shivaedev/sql`: `keysetPage` builds native statement fragments without requiring a `SqlClient` service; its read callback retains its own service requirements.

### Breaking

- `@shivaedev/jobs`: Requires the catalog-compatible `@effect/sql-pg` peer to compile shared keyset fragments through the existing pg-boss connection. Consumers must install `@effect/sql-pg` alongside `@shivaedev/jobs`, `pg-boss` and `effect`.
