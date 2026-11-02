---
"@shivaedev/sql": minor
"@shivaedev/test-sql": minor
---

### Added

- `@shivaedev/sql`: `sql`'s `postgresLayer` provides its own Reactivity service alongside `PgPool`, `PgClient` and `SqlClient`.
- `@shivaedev/test-sql`: `test-sql` fixtures expose `PgPool` and accept production pool options for preparation, shared databases, clones and administration.

### Fixed

- `@shivaedev/test-sql`: `test-sql` builds fixture clients through the production SQL Layer, keeping clone pool maintenance on the live clock, Reactivity local to each database and sockets closed before database cleanup.

### Breaking

- `@shivaedev/test-sql`: Remove `connection` from `test-sql/server/internal/databases.ts`. Consumers of that internal helper must use `postgresLayer(url, { maxConnections, ...options })` from `@shivaedev/sql/postgresLayer.ts`.
