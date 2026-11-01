---
"@shivaedev/local-postgres": minor
---

### Fixed

- Accept PostgreSQL 18.6 distribution version suffixes and leave native server connection limits unchanged when the managed container is unavailable.
- Return a typed `LocalPostgresError` for malformed URL password escapes instead of a defect.

### Breaking

- `clientConnection` now returns an Effect. Replace direct calls with `yield* clientConnection(url, options)` inside an Effect program so password decoding failures stay in the typed error channel.
