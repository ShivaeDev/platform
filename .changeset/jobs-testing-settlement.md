---
"@shivaedev/jobs": minor
---

### Breaking

- `waitForIdle` discovers all registered job queues, including producer-only definitions, and waits for ready and active work across clients. Consumers that previously ignored ready jobs without local workers must run a worker for those jobs or leave them scheduled for the future before settling.
- `UnfinishedJob.state` includes `deferred`. Handle this state when reading `snapshot(queues)`: a future `RetryAt` deferral reads as `deferred`, while a due deferral or a retry after a failure reads as `retry`.
