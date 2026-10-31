---
"@shivaedev/server": minor
---

### Fixed

- Run application database pool maintenance and change-listener heartbeats, deadlines and renewal on the live clock so a running host can advance its story clock by days while retaining database access, worker writes and change hints.

### Added

- Accept `config.clock` on `appDatabase` and `appHost` for stories that explicitly exercise database lifecycle timers with their test clock. Application handlers and jobs keep their application clock.

### Breaking

- Database lifecycle timers use the live clock instead of the caller's clock by default. Stories that advance time to exercise pool expiry, listener renewal or heartbeat deadlines must pass their native `yield* Clock.Clock` as `config.clock` to `appDatabase` or `appHost`.
