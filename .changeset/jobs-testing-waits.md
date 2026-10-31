---
"@shivaedev/jobs": minor
---

### Added

- The testing controller's `untilJob(queue, id, state)` waits on the controller's change signal until a job reaches a state and returns it with its data decoded through the queue's Schema.
- The testing controller's `fetchesPass(queue, n)` completes once `n` worker fetches on the queue that began after the wait have finished, so a story can show a job stayed untaken without sleeping.
- Both waits give up after `within` (default 20 seconds of wall time, unaffected by a `TestClock`) with `PgBossWaitError`, whose message names what the wait expected and what it last saw.

### Changed

- The testing controller's `waitForChange` also wakes after each worker fetch that claims nothing, so a kit waiting on it re-reads once per poll.
