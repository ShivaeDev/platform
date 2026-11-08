---
"@shivaedev/admin": minor
"@shivaedev/jobs": minor
---

### Breaking

- `@shivaedev/admin`: `jobsReadHandlers` now takes only the page and reads the `PgBossInspection` service from its Effect environment. Direct callers migrate from `jobsReadHandlers(JobsPage, JobsService)` to `jobsReadHandlers(JobsPage)` and provide `PgBossInspection`; `jobsHandlers` and `jobsHandlersWithRetry` keep their existing service-tag parameters and provide inspection internally.
- `@shivaedev/admin`: duplicate page ids, RPC tags and routes now fail with the same messages when the handler Layer is built, rather than while `adminRegistry` is called. `validateAdminRoutes` now returns an Effect; direct callers should yield it instead of calling synchronously.
- `@shivaedev/jobs`: the pg-boss client types, retry wake helper and client error observer moved from `server/client.ts`, `server/retryWake.ts` and `server/clientErrors.ts` into `server/adapters/`. Update internal adapter imports accordingly; callers typing a custom client factory can derive its type from `PgBossOptions["clientFactory"]` in `server/service.ts`.

### Changed

- `@shivaedev/jobs`: invalid `maxDeferrals` declarations now fail with the same message when a jobs Layer is built, rather than while `defineQueue` or `defineSchedule` is called.
