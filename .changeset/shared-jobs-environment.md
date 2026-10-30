---
"@shivaedev/jobs": minor
"@shivaedev/service": minor
"@shivaedev/admin": minor
"@shivaedev/webhooks": minor
---

### Added

- Jobs services share one scoped pg-boss client through the Effect environment. Registration, worker and producer Layers use the same connection and pool settings.
- Service definitions accept marked generic methods alongside declared dependencies. Generic signatures retain their caller requirements unchanged; initialization can capture declared dependencies as private state.

### Breaking

- Move connection, pool, client factory, cache key and stop options from each `Jobs.layer` call into one `pgBossLayer` from `@shivaedev/jobs/server/service.ts`. Supply `connectionString` as `Redacted<string>` and provide that Layer to the merged jobs services. Keep only `jobs` and `onError` in `Jobs.layer`.
- Call `jobs.health()` instead of yielding `jobs.health`. Custom jobs service implementations must expose health as a method. Admin's built-in jobs handlers call the method automatically. Jobs services passed to webhook routes and enqueue helpers must also implement the new method shape.
