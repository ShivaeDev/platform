---
"@shivaedev/jobs": patch
---

### Fixed

- Keep testing expiry failures in the Effect error channel as `PgBossTestingError`, with the original failure and queue retained.
