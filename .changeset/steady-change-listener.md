---
"@shivaedev/sql": minor
"@shivaedev/server": patch
---

### Fixed

- `@shivaedev/sql`: Keep PostgreSQL change listeners connected past the query pool's connection lifetime so live subscriptions receive committed changes without periodic Resync. Reconnect and resynchronize when the listener connection is lost.
- `@shivaedev/server`: Keep shared and separate LISTEN connections open past the database pool's TTL without resynchronizing live subscribers on a timer.

### Breaking

- `@shivaedev/sql`: Remove `connectionTTL` from `PostgresChangesOptions`. Remove that option from direct `postgresChanges` calls; keep `connectionTTL` on `postgresLayer` or the server database config to recycle query connections.
