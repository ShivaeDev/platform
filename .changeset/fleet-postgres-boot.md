---
"@shivaedev/work-fleet": patch
---

### Fixed

- Wait for PostgreSQL during daemon startup with exponential backoff and a clear log instead of exiting while the database starts. After five minutes, fail with a typed `HostFailure` naming `database.url`.
