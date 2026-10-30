---
"@shivaedev/jobs": minor
---

### Fixed

- Keep job batches, handler timeouts, retry wakeups and client error callbacks in the Layer's captured Effect environment, preserving worker logging context, Clock and scoped interruption while allowing native graceful stop to drain active handlers.
- Retry queue creation deadlocks with an Effect Schedule, and report RetryAt settlement failures as typed PgBossError failures.
- Decode schema inspection and index recovery rows before using them.

### Breaking

- Custom `PgBossClient` implementations must honor pg-boss's `offWork(name, { id, wait })` options. Scoped workers now unregister their own registration and drain its active batch before releasing handler services, including when Layers share a cached client. Forward these options to native pg-boss; the default client needs no migration.
