---
"@shivaedev/server": minor
"@shivaedev/sql": minor
---

### Breaking

- `@shivaedev/server`: Declare `postgresSettings` explicitly when building `appDatabase`, a database-backed `appHost`, or `workerHost`; use `{}` to request no server changes. Startup applies differing PostgreSQL server settings outside migrations and warns about refused values and pending restarts. Drop calls and imports of the removed `trimPostgresPageCache`; page-cache trimming belongs in the PostgreSQL service start command.
- `@shivaedev/sql`: Drop calls and imports of the removed `applyLowMemoryPostgres`. Move desired server values into the host's required `postgresSettings` declaration, typed by `PostgresSettings` from `@shivaedev/sql/postgresSettings.ts`.
