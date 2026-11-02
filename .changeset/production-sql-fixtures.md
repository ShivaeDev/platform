---
"@shivaedev/sql": minor
"@shivaedev/test-sql": minor
---

### Added

- `sql`'s `postgresLayer` provides its own Reactivity service alongside `PgPool`, `PgClient` and `SqlClient`.
- `test-sql` fixtures expose `PgPool` and accept production pool options for preparation, shared databases, clones and administration.

### Fixed

- `test-sql` builds fixture clients through the production SQL Layer, keeping clone pool maintenance on the live clock, Reactivity local to each database and sockets closed before database cleanup.

### Breaking

- Remove `connection` from `test-sql/server/internal/databases.ts`. Consumers of that internal helper must use `postgresLayer(url, { maxConnections, ...options })` from `@shivaedev/sql/postgresLayer.ts`.
