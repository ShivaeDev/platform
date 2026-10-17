### Added

- `PgBossService.counts(queue)` returns live `QueueCounts` without waiting for the pg-boss monitor; `health` keeps using cached counts.
- `PgBossService.getJob(queue, id)` returns optional job metadata with Schema-decoded payloads and decoding service requirements. `PgBossService.retry(queue, id)` reprocesses failed or retry-waiting jobs under their original ID.
- `PgBossQueueOptionsError` identifies immutable queue option conflicts during Layer acquisition. Custom `PgBossClient` factories can provide optional native `findJobs`, `retry`, `update`, `getDb` and `updateQueue` capabilities for the new operations.

### Fixed

- Queue and schedule definitions accept pg-boss's full `Queue` options except the owned name and dead-letter setup, including notification delivery, policy, partitioning, heartbeat and backlog warnings.
- Startup reconciles declared mutable queue settings through `updateQueue`, including expiry and retry limits, so they reach existing queues after restart.
