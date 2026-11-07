---
"@shivaedev/admin": minor
"@shivaedev/jobs": minor
---

### Breaking

- `@shivaedev/admin`: `jobsHandlers` and `jobsReadHandlers` no longer take an application-specific Jobs service tag. Migrate by calling `jobsHandlers(JobsPage)` or `jobsReadHandlers(JobsPage)` and provide `PgBossInspection` from the existing runtime with `Layer.effect(PgBossInspection, Effect.flatMap(JobsService, (jobs) => jobs.inspection()))`. `jobsHandlersWithRetry` also requires that inspection service alongside its Jobs service tag.
- `@shivaedev/admin`: duplicate page ids, RPC tags and routes now fail with the same messages when the handler Layer is built, rather than while `adminRegistry` is called. `validateAdminRoutes` now returns an Effect; direct callers should yield it instead of calling synchronously.
- `@shivaedev/jobs`: the pg-boss client types, retry wake helper and client error observer moved from `server/client.ts`, `server/retryWake.ts` and `server/clientErrors.ts` into `server/adapters/`. Update direct imports to `@shivaedev/jobs/server/adapters/client.ts`, `@shivaedev/jobs/server/adapters/retryWake.ts` and `@shivaedev/jobs/server/adapters/clientErrors.ts` respectively.

### Changed

- `@shivaedev/jobs`: invalid `maxDeferrals` declarations now fail with the same message when a jobs Layer is built, rather than while `defineQueue` or `defineSchedule` is called.
