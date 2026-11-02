---
"@shivaedev/sql": patch
"@shivaedev/jobs": patch
"@shivaedev/server": patch
---

### Fixed

- Fail the scope coordinating a worker release with the original cause when heartbeat or ownership polling retries are exhausted, and stop registered jobs workers before removing the release lease. Application-host workers can no longer keep fetching after their release coordinator fails.
