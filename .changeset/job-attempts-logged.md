---
"@shivaedev/jobs": minor
---

### Added

- A worker logs each job attempt that fails or reaches its deadline as one error-level line, so an application no longer wraps its handlers to see failed or timed-out jobs. A failed attempt, including a payload that fails to decode, logs `Job attempt failed` with its failure as the cause, passed through the errors package's diagnostic redaction. An attempt that times out logs `Job attempt hit its <expireInSeconds>s deadline`: an attempt stopped at its deadline, whichever of the worker's deadline and pg-boss's batch timeout fires first, a claimed job whose window had already passed, and each job its batch leaves to pg-boss's expiry once pg-boss ends its claim after its window has passed on PostgreSQL's clock. Each line carries the `job.queue`, `job.id` and `job.attempt` annotations of the job span and `job.outcome`, which is `failed` or `deadline`, and an attempt logs at most one. A success, a `RetryAt` deferral, an abort of the job's signal before its window has passed and an interruption by shutdown or a drain timeout log no such line. Applications that already log failures in a handler wrapper can delete that wrapper or expect a second line.
