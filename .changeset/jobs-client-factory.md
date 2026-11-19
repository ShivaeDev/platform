---
"@shivaedev/jobs": minor
---

### Added

- `JobsClientFactory` from `@shivaedev/jobs/server/JobsClientFactory.ts` is the Context service that `pgBossLayer` constructs its pg-boss client with. Its default is `defaultClientFactory`, so production code provides nothing; a test provides `Layer.succeed(JobsClientFactory, testing.clientFactory)` once where a runtime's jobs Layers are built.

### Breaking

- `pgBossLayer` no longer accepts a `clientFactory` option, and `PgBossOptions` no longer has that field. Move the factory into a Layer: change `pgBossLayer({ clientFactory: testing.clientFactory, connectionString })` to `pgBossLayer({ connectionString }).pipe(Layer.provide(Layer.succeed(JobsClientFactory, testing.clientFactory)))`, or provide that Layer around the application Layer that builds `pgBossLayer`. An application that kept its own client-factory service, such as the starter's former `app/JobsClientFactory` in `src/server/JobsClientFactory.ts`, deletes it, imports `JobsClientFactory` from `@shivaedev/jobs/server/JobsClientFactory.ts` in its tests, and builds `pgBossLayer` without reading the factory itself; its `replacements` Layer must reach the Layer that builds `pgBossLayer`.
