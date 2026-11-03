---
"@shivaedev/jobs": minor
"@shivaedev/admin": patch
---

### Added

- `@shivaedev/jobs`: Expose `PgBossInspection` for stored jobs, deferrals, expiry, queue diagnostics and scoped PostgreSQL queue-change signals. Jobs runtimes also expose the service through `inspection()`.

### Changed

- `@shivaedev/jobs`: The testing controller reads through inspection and waits on committed queue changes, including work done by another client, without production testing hooks or private settlement spies.
- `@shivaedev/admin`: Jobs pages read queue state through the shared jobs inspection service.

### Breaking

- `@shivaedev/jobs`: Import `SnapshotQueue` and `UnfinishedJob` from `@shivaedev/jobs/server/inspection.ts` instead of `server/testing.ts`.
- `@shivaedev/jobs`: Remove `__test__enableSpies` from client options. Replace `EngineClient.getSpy` waits with inspection `changes()`. Replace `getJobById(name, id)` with `storedJobs({ name }, { id })`, taking the first result; missing jobs return an empty array.
