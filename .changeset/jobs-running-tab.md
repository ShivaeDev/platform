---
"@shivaedev/jobs": minor
"@shivaedev/admin": minor
---

### Added

- `@shivaedev/jobs`: `activeJobs(queue, { limit, cursor? })` on the jobs service and `PgBossInspection` lists a queue's running jobs, oldest start first and paged like `failedJobs`. Each `ActiveJob` from `@shivaedev/jobs/server/health.ts` carries `id`, `queue`, `attempt`, `startedOn`, `deadline` (its start plus `expireInSeconds`) and `timeLeft`, a `Duration` measured against PostgreSQL's clock in the same query and negative once the deadline has passed. It reads no payload.
- `@shivaedev/admin`: the Jobs page gains an `admin.jobs.running` query on both `JobsPage` and `JobsPageWithRetry`, returning `JobsRunning` entries from `@shivaedev/admin/jobs/Running.ts`. `JobsView` shows them under a Running tab beside Failed and Dead-lettered, with each job's queue, ID, attempt, start time, deadline and time left, `past deadline` once the deadline has passed and `No running jobs.` when nothing runs. A bound retry or run-now also refreshes the running listing.

### Breaking

- `@shivaedev/jobs`: `PgBossService` and `PgBossInspectionService` from `@shivaedev/jobs/server/service.ts` and `@shivaedev/jobs/server/inspection.ts` now require `activeJobs`. An object that implements either type itself, such as a test fake, adds `activeJobs: (queue: { name }, options: JobPageOptions) => Effect<JobPage<ActiveJob>, PgBossError | PgBossPayloadError | SchemaError>`. Services built by `makePgBoss` and `PgBossInspection.layer` already provide it.
- `@shivaedev/admin`: `JobsViewClient` from `@shivaedev/admin/client/jobsTypes.ts` now requires a `running` query. A custom client passed to `JobsView` adds `running` taking `{ queue, limit, cursor? }` and returning `{ jobs: readonly JobsRunning[], next: Option<string> }`; the Jobs page contract's bound client already has it.
- `@shivaedev/admin`: `RegisteredQueues` from `@shivaedev/admin/server/RegisteredQueues.ts` now requires `activeJobs(queue, { limit, cursor? })`, returning `JobPage<ActiveJob>` with the same failures as `failedJobs`. An application that provides its own `RegisteredQueues` Layer adds it; `pgBossQueues` already does.
