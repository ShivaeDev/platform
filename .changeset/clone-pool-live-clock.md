---
"@shivaedev/test-sql": patch
---

### Fixed

- Run cloned PostgreSQL pools' housekeeping timers on the live clock so large story TestClock jumps do not wake pool maintenance once per simulated minute. Story Effects retain their TestClock.
