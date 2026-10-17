### Added

- `JobContext.remainingBudget` is an `Effect.Effect<Duration.Duration>` that reads the time left until the fetched job's expiry deadline, clamped to zero.

### Fixed

- Bound queue and scheduled handlers by each job's pg-boss `startedOn` plus `expireInSeconds`, including time spent waiting in a batch. Skip jobs whose window has passed and interrupt running Effects at their deadline, leaving interrupted and unstarted jobs for pg-boss expiry and retry. Worker registration requests start-time metadata even when `includeMetadata: false` is supplied.
