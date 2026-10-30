---
"@shivaedev/sql": minor
"@shivaedev/server": minor
---

### Fixed

- Retry worker-release heartbeat and poll failures on a bounded schedule, log their causes, and close the worker scope with the original cause when recovery fails. Heartbeats continue while jobs drain after a connection blip.
- Log change-listener loss and reconnect causes, and bound listener sub-scope cleanup without rewriting scope finalizers.
- Fail application database startup when its first PostgreSQL LISTEN or heartbeat fails, instead of waiting indefinitely.

### Breaking

- `postgresChanges` and `listenForChanges` now expose `SqlError` during acquisition. Consumers that required an infallible Layer or Effect must handle or propagate this error. `heartbeatTimeout` bounds the first LISTEN acquisition and its first heartbeat; retry startup at the application boundary if desired. Established listeners continue to reconnect.
