---
"@shivaedev/test-sql": minor
---

### Added

- `observeUntil(read, settled, waitingFor, options?)` from `@shivaedev/test-sql/server/observeUntil.ts` waits for PostgreSQL state that sends no notification, such as sessions in `pg_stat_activity` or lock waiters. It repeats one read on live time, even under a paused test clock, and returns the value once `settled` holds for `stableReads` reads in a row (default 2), so a value that flips back is not accepted. When `within` (default 5 seconds) runs out it fails with a typed `NeverSettled` whose message names what it waited for, the read count and the last value.

### Breaking

- `raceWithLock` waits for its contenders to block through `observeUntil`, so that wait runs on live time. Its `timeout` now bounds each phase on its own: taking the lock and the contenders' finish after release still fail with `TimeoutError`, while contenders that never all block fail with `NeverSettled` naming how many blocked. Handle `NeverSettled` wherever you handled the `TimeoutError` of contenders that never queued on the lock.
