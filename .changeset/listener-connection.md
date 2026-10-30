---
"@shivaedev/sql": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/server`: Configure a direct or session-mode change listener with `config.listenDatabaseUrl` or `LISTEN_DATABASE_URL`, falling back to the application connection when unset.
- `@shivaedev/sql`: Supply `listenerClient` separately from the writing `client` to `postgresChanges`; set `connectionSetting` to identify that connection in diagnostics.

### Breaking

- Listener startup deadlines now fail with `PostgresListenerError`, naming the connection setting, instead of `SqlError`. Consumers handling startup failures must also handle `PostgresListenerError` from `@shivaedev/sql/PostgresListenerError.ts`. Hosts using transaction-pooled application URLs must set `LISTEN_DATABASE_URL` or `config.listenDatabaseUrl` to a direct or session-mode connection to the same database. Native SQL startup failures still use `SqlError`.
