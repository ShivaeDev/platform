---
"@shivaedev/quality": minor
---

### Added

- Flag direct `Config` and `process.env` reads of `*DATABASE_URL` variables in test-support with `tests/database-url`; use test-sql's `postgresTestUrl` so missing URLs fail in CI.
