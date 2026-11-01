---
"@shivaedev/sql": minor
---

### Breaking

- Migration runners now hold a session advisory lock through components and release publication. Allocate at least two pool connections for an active runner plus capacity for waiting runners and other work, and migrate transaction-pooled connections to direct connections or session pooling. Components continue to run outside the ledger transaction.

### Fixed

- Publish a release only after every component succeeds, and reject marker writes from invocations older than the recorded one. `recordedAt` identifies the invocation's PostgreSQL start time; a new invocation can still deploy an earlier release label.
