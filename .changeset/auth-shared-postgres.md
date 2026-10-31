---
"@shivaedev/identity": minor
"@shivaedev/server": minor
"@shivaedev/platform": minor
---

### Breaking

- Replace `authDatabase(url, { max, application_name })` from identity's `server/better-auth/mount.ts` with `yield* betterAuthDatabase()` from `server/better-auth/adapters/database.ts`, inside the application's SQL environment. Pass the result as Better Auth's `database`. Use sql's `postgresLayer` for standalone processes; database-backed `appHost` exposes the client inside its `application` Effect. Move connection settings to `maxConnections` and `applicationName` on that SQL Layer. Auth now shares its connection budget and lifecycle; remove direct `pg` dependencies when no longer used.
- Replace `authTestDatabase(pool)` with `yield* authTestDatabase` in identity test fixtures, provided with the application's `SqlClient`.

### Changed

- Server and the platform dependency shell no longer declare `pg` as an optional peer; its PostgreSQL integration uses the native pool from sql.
