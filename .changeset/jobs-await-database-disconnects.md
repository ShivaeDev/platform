---
"@shivaedev/effect-pg-boss": patch
---

### Fixed

- Wait for PostgreSQL transports to disconnect when the default or testing jobs client closes, so its owning scope finishes cleanup before an isolated application database is dropped.
