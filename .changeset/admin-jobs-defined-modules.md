---
"@shivaedev/admin": minor
---

### Breaking

- The Jobs pages are fixed pages instead of factories over the queue list. Replace `jobsPage(...queues)` from `@shivaedev/admin/jobs/page.ts` with `JobsPage` from `@shivaedev/admin/jobs/Page.ts`, and `jobsPageWithRetry(...queues)` from `@shivaedev/admin/jobs/retryPage.ts` with `JobsPageWithRetry` from `@shivaedev/admin/jobs/PageWithRetry.ts`. The pages no longer carry `queues` or `schedules`: pass the application's queue and schedule declarations to `JobsView` directly.
- Their operations are the modules `Jobs` from `@shivaedev/admin/Jobs.ts` and `JobsWithRetry` from `@shivaedev/admin/JobsWithRetry.ts`, which are server code. Replace `jobsHandlers(page, JobsService)` (`@shivaedev/admin/server/jobsHandlers.ts`) with `moduleHandlers(Jobs)` and `jobsHandlersWithRetry(page, JobsService)` (`@shivaedev/admin/server/jobsHandlersWithRetry.ts`) with `moduleHandlers(JobsWithRetry)`, with `moduleHandlers` from `@shivaedev/contract/moduleHandlers.ts`, and provide `pgBossQueues(JobsService, ...queues)` from `@shivaedev/admin/server/adapters/pgBossQueues.ts` to the handlers. `jobsReadHandlers` and `jobsFailures` are removed. Browser code that needs the client contracts imports `Jobs` from `@shivaedev/admin/generated/Jobs.ts` and `JobsWithRetry` from `@shivaedev/admin/generated/JobsWithRetry.ts`.
- Listed jobs and job details are `JobsRow` from `@shivaedev/admin/jobs/Row.ts` and dead-letter copies are `JobsDeadLetter` from `@shivaedev/admin/jobs/DeadLetter.ts`; `jobSchema`, `deadLetteredSchema`, `jobPage` and `JobsFailures` from `@shivaedev/admin/jobs/schemas.ts` are removed. A job's `queue` and a copy's `sourceQueue` are strings. `JobsNotFailed` moved from `@shivaedev/admin/jobs/retryPage.ts` to `@shivaedev/admin/jobs/NotFailed.ts`.
- Each Jobs operation declares only the rejections it can raise, and `next`, job lookups and `runScheduleNow` travel as encoded `Option` values instead of nullable ones; deploy the browser and the server together.

### Added

- `RegisteredQueues` from `@shivaedev/admin/server/RegisteredQueues.ts` holds the queues operators may administer; `pgBossQueues` builds it from the application's jobs service, keeping the payload Schemas' decoding services on its Layer.
