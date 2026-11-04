---
"@shivaedev/server": minor
---

### Fixed

- Import and start HTTP-only or native RPC application hosts without installing `@effect/sql-pg`.

### Breaking

- Import database-backed `appHost` and `AppDatabaseOptions` from `@shivaedev/server/appDatabase.ts`. Import `AppHostOptions` and `AppLocalHostOptions` from `@shivaedev/server/AppHostInput.ts`. Keep the existing migration and deferred application options. Hosts without database wiring continue to import `appHost` and `AppHttpHostOptions` from `@shivaedev/server/appHost.ts` and need only `@effect/platform-node` alongside Effect.
- Import `migratedHost` and `deferredHost` from `@shivaedev/server/appDatabaseHttp.ts` when composing the host at that level.
