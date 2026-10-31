---
"@shivaedev/jobs": patch
---

### Fixed

- Keep a claimed job running until its translated expiry deadline when the host timer wakes early, including deadlines with fractional milliseconds from PostgreSQL.
