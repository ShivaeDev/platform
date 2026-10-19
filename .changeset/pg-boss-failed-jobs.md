---
"@shivaedev/effect-pg-boss": minor
---

### Added

- The jobs service lists a queue's failed jobs with `failedJobs(queue, { limit, cursor })` and the jobs in its dead-letter queue with `deadLetteredJobs(queue, { limit, cursor })`, newest first in pages with an opaque cursor. Each entry carries the job's ID, queue, state, attempt and retry counts, UTC times, the output pg-boss stored, and `data` decoded by the queue's Schema; invalid stored data fails with `PgBossPayloadError`. Dead-letter entries add the original job's ID and error. A failed entry's ID can be passed to `retry`.
