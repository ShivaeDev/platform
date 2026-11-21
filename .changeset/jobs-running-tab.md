---
"@shivaedev/jobs": minor
"@shivaedev/admin": minor
---

### Added

- `@shivaedev/jobs`: `activeJobs(queue, { limit, cursor? })` on the jobs service and `PgBossInspection` lists a queue's running jobs, oldest start first and paged like `failedJobs`. Each `ActiveJob` from `@shivaedev/jobs/server/health.ts` carries `id`, `queue`, `attempt`, `startedOn`, `deadline` (its start plus `expireInSeconds`) and `timeLeft`, a `Duration` measured against PostgreSQL's clock in the same query and negative once the deadline has passed. It reads no payload.
- `@shivaedev/admin`: the Jobs page gains an `admin.jobs.running` query on both `JobsPage` and `JobsPageWithRetry`, returning `JobsRunning` entries from `@shivaedev/admin/jobs/Running.ts`. `JobsView` shows them under a Running tab beside Failed and Dead-lettered, with each job's queue, ID, attempt, start time and time left, `past deadline` once the deadline has passed and `No running jobs.` when nothing runs. A bound retry or run-now also refreshes the running listing. A custom `JobsViewClient` now needs a `running` query.
