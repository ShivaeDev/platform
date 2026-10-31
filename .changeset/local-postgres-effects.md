---
"@shivaedev/local-postgres": minor
"@shivaedev/server": minor
"@shivaedev/create-app": minor
---

### Breaking

- `@shivaedev/local-postgres`: `assertLocalDatabase`, `sql`, `startPostgres`, `prepareDatabases` and lower-level command helpers return Effects. Yield them in an Effect program and provide `ChildProcessSpawner` for commands, for example with `NodeServices.layer` at a Node entry point. Replace synchronous try/catch with Effect error handling. Command failures use `PostgresCommandError`; local-target and image refusals use `LocalPostgresError`. Construct the Schema tagged errors as `new PostgresVersionMismatch({ expectedVersion: "18.6", observedVersion })` or `new PostgresSettingError({ container: "development-postgres", setting: "max_connections", cause })`. Exhausted readiness checks retain their final failure instead of reporting an unobserved version mismatch.
- `@shivaedev/server`: `setupDatabases()` requires `ChildProcessSpawner` and exposes local PostgreSQL failures in its typed error channel. Provide `NodeServices.layer` at the setup entry point instead of relying on synchronous commands hidden inside the host.

### Fixed

- Generated applications provide Node services when running database setup, so setup commands participate in Effect interruption and typed failure handling.
