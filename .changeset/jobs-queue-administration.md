---
"@shivaedev/jobs": minor
---

### Added

- Add `unschedule`, `deleteQueue` and `refreshQueueStats` to the jobs service so applications can administer queues through their owned client. Missing queues and schedule registrations fail with `PgBossNotFoundError`; engine failures retain the operation in `PgBossError`.
