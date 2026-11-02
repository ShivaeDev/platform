---
"@shivaedev/jobs": patch
---

### Fixed

- Wake idle workers when `RetryAt` deferrals become due, without waiting for the polling backstop. Retry and deferral wakes account for differences between the runtime and PostgreSQL clocks.
