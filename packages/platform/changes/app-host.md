### Added

- `appHost`, `appDatabase`, `AppChanges`, `AppHostOptions` and `AppDatabaseOptions` in `appHost.ts`: one scoped local HTTP/NDJSON RPC host with transport guard, session middleware, static assets, migrated PostgreSQL and commit-bound live hints; the database Layer also serves workers. The host requires the optional `@effect/platform-node` and `@effect/sql-pg` peers.
