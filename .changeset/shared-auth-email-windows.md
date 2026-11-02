---
"@shivaedev/identity": minor
"@shivaedev/rate-limit": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/identity`: Auth email limits now use PostgreSQL exclusively and share one per-account, per-kind window across mounts and restarts. Apps configuring `betterAuthMount` with `emails` must provide their PostgreSQL Layer (`SqlClient` and `Reactivity`) to the mount and include `postgresMigration` from `@shivaedev/rate-limit/adapters/postgresMigration.ts` in their numbered migration loader before starting the app. Remove imports of the deleted `server/better-auth/emailWindow.ts` helper. Request rate limits still use the app's supplied store.

### Added

- `@shivaedev/rate-limit`: Expose `postgresTestDatabase` with an `expireWindows` fixture for isolated PostgreSQL stories exercising expired budgets.

### Fixed

- `@shivaedev/create-app`: Generated apps include the rate-limit store migration so authentication emails use the shared PostgreSQL window.
