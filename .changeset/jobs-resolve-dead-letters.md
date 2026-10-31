---
"@shivaedev/jobs": minor
"@shivaedev/admin": minor
---

### Added

- Jobs dead-letter entries and admin Jobs RPC responses carry `sourceQueue`, the name of the original queue.

### Fixed

- Successful jobs clear their dead-letter copies in the completion transaction. Copies of unretried jobs and failed retries remain listed. Schema installation also clears copies whose retained source already completed.

### Breaking

- Consumers constructing `DeadLetteredJob` values or admin dead-letter responses must supply `sourceQueue`. Applications using `migrate: false` must run `installPgBossSchema` during upgrade to install the completion trigger.
