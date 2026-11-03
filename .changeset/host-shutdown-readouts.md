---
"@shivaedev/server": minor
---

### Added

- Read a child host's active work, completed finalizers and shutdown duration through the process kit, including after a reported shutdown. Instrument child Effects with `hostProcessReadouts`.
- Launch a host with a proxied `databaseUrl` and cut its idle PostgreSQL connections with `disconnectIdlePostgres` to exercise recovery.
