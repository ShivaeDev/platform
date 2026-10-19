---
"@shivaedev/effect-pg-boss": minor
---

### Added

- The testing controller reads the unfinished jobs of several queues in one consistent snapshot with `snapshot(queues)`: created, retry, active and failed jobs with their queue, state, start-after time and decoded data, leaving completed jobs out and undecoded.
- The testing controller's `waitForIdle` completes when its local workers hold no job in flight and none of their queues has a job ready to fetch. Jobs that start later do not hold it open, and it reads nothing while a fetched batch is still running, so a story kit settles with one read per idle.

### Fixed

- `waitForChange` no longer resumes at once when a waiter that a change resumed waits again in the same step; it waits for the next change.
