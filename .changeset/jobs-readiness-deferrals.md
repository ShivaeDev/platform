---
"@shivaedev/jobs": patch
"@shivaedev/server": patch
---

### Fixed

- `@shivaedev/jobs`: The pg-boss schema readiness check reports missing deferral tables, cleanup indexes, functions and triggers even when the pg-boss version is current. Its pending detail names the missing artifacts.
- `@shivaedev/server`: Hosts using the pg-boss schema component wait for missing deferral artifacts to be installed before starting the application, and check mode names those artifacts.
