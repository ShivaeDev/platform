---
"@shivaedev/jobs": minor
---

### Added

- Refresh cached queue statistics through `testing.refreshQueueStats(queue?)` before reading health.
- Read and await jobs with null payloads through `testing.jobs({ name, schema: Schema.Null })` and `testing.untilJob`.

### Breaking

- `testing.trigger(schedule)` returns the run ID, or null when pg-boss suppresses the send, instead of void. Consumers that require an `Effect<void>` should apply `Effect.asVoid` to the result.

### Fixed

- Apply testing expiry controls to triggered schedule runs.
