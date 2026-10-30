---
"@shivaedev/sql": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/sql/postgresLayer.ts` provides `postgresLayer(url, options)` with one native `PgPool` shared by `PgClient` and `SqlClient`. Reserved connections and client queries share `maxConnections`, and Layer shutdown waits for every socket to close.
- `appDatabase` and database-backed `appHost` expose the application's native `PgPool` service for packages that need reserved PostgreSQL connections.

### Breaking

- Server's PostgreSQL construction and address helpers move to sql. Consumers of `@shivaedev/server/adapters/postgresClient.ts` must compose `postgresLayer` from `@shivaedev/sql/postgresLayer.ts` and read the native `PgPool` or `PgClient` service instead. Address-only consumers import `databaseAddress` from `@shivaedev/sql/databaseAddress.ts` instead of `@shivaedev/server/databaseAddress.ts`.
