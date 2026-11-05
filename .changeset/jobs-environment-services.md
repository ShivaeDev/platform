---
"@shivaedev/jobs": minor
---

### Changed

- Provide job storage and inspection services through the existing jobs and inspection Layers. Operations yield their dependencies and emit service operation spans while preserving caller payload context and SQL transaction participation.

### Breaking

- Replace direct imports of `PgBossOperations`, `PgBossInitialization`, `initializeJobs`, `initializeInspection`, `makeService`, `enqueueFor`, `jobControl`, `jobListings` and `server/operations/*` with `makePgBoss` from `server/service.ts` and its Layer-bound methods. Use `jobs.inspection()` or the existing `PgBossInspection.layer` for typed inspection instead of the client-taking `inspection`, `inspectionReads`, `inspectionJobs` and `inspectionSnapshot` adapter helpers, which now expose storage reads. The low-level storage service now lives at `server/services/operations/service.ts` and accepts encoded data; its shape is not the typed jobs facade.
- Import registration and definition Layer bridges from `server/adapters/register.ts`, `server/adapters/registerReleasedJobs.ts` and `server/adapters/pgBossDefinitionLayer.ts`. Registration reads its Effect context and scope from the environment; remove those arguments and provide worker services and `PgBoss` in the environment. `registerWorker` also reads its scope from the environment. `runQueueWorker` yields `PgBoss`; remove its client and schema arguments. Move direct `ensureQueue`, `countsFor` and `healthFor` imports to `server/adapters/`. `runSchemaPlan` is now an Effect that yields `SchemaConnection`; provide the reserved SQL connection through that service instead of passing a connection and runner.
