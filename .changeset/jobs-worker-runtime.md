---
"@shivaedev/jobs": patch
---

### Fixed

- Keep job batches, handler timeouts, retry wakeups and client error callbacks in the Layer's captured Effect environment, preserving worker logging context, Clock and scoped interruption.
- Retry queue creation deadlocks with an Effect Schedule, and report RetryAt settlement failures as typed PgBossError failures.
- Decode schema inspection and index recovery rows before using them.
