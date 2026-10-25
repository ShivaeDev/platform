---
"@shivaedev/effect-sql": minor
"@shivaedev/effect-contract": minor
---

### Added

- `effect-sql` logs one lost warning per PostgreSQL listener outage and an info line after recovery, with `downtimeMs` since that warning and `streamCount` for the live streams resynchronized. Failed reconnect attempts log at debug. Initial successful startup logs neither outage line, and outage diagnostics omit database error causes and connection details.
- `effect-contract`'s `makeLiveServer.resync` reports the number of open live streams it marked for reconciliation, excluding streams whose scopes have closed.

### Breaking

- Direct `postgresChanges` callers must supply `resync: Effect.Effect<number>` instead of `Effect.Effect<void>`. Pass `makeLiveServer.resync` unchanged, or return the number of open streams marked by your own stream owner.
