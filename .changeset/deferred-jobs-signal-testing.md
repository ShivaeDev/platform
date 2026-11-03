---
"@shivaedev/jobs": patch
---

### Fixed

- Advance the testing controller's revision when a job's deferral commits, before the next job in its batch runs, without waiting for PostgreSQL notifications.
