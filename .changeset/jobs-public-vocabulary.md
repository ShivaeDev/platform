---
"@shivaedev/jobs": minor
"@shivaedev/admin": minor
"@shivaedev/email": minor
"@shivaedev/webhooks": minor
---

### Breaking

- `@shivaedev/jobs`: Public declarations use jobs-owned types, including adapter and testing signatures. Replace pg-boss `WorkOptions`, `SendOptions`, `ScheduleOptions`, `ConstructorOptions`, `StopOptions`, `FindJobsOptions` and `JobWithMetadata` annotations with `WorkerOptions` from `@shivaedev/jobs/server/workerOptions.ts`, `EnqueueOptions` and `ScheduleOptions` from `@shivaedev/jobs/server/enqueueOptions.ts`, `ClientOptions` and `StopOptions` from `@shivaedev/jobs/server/clientOptions.ts`, `JobReadOptions` from `@shivaedev/jobs/server/client.ts`, and `Job` from `@shivaedev/jobs/server/job.ts`. `JobState` is declared in `@shivaedev/jobs/server/job.ts`; job reads explicitly allow null `startedOn` and `output` values, which callers must handle before dereferencing. Database adapters use `ClientDatabase` from `@shivaedev/jobs/server/ClientDatabase.ts`; decode their unknown row values before use.
- `@shivaedev/jobs`: Move `QueueOptions` and `QueuePolicy` imports from `@shivaedev/jobs/server/definition.ts` to `@shivaedev/jobs/server/queueOptions.ts`. The previous module no longer exports those names. Move `batchHandler` imports from `@shivaedev/jobs/server/internal/batchHandler.ts` to its engine adapter at `@shivaedev/jobs/server/adapters/batchHandler.ts`.
- `@shivaedev/jobs`: `defaultClientFactory` returns the jobs-owned `EngineClient` contract from `@shivaedev/jobs/server/engineClient.ts`. Code needing additional engine methods must own a pg-boss client in its custom factory. Constructor OpenTelemetry options support `enabled` and `propagateContext`; configure custom OpenTelemetry providers on the client inside that factory.
- `@shivaedev/admin`: The built-in Jobs page compiles against jobs-owned `JobState` and `ListedJob` contracts. Replace explicit pg-boss metadata annotations with types from `@shivaedev/jobs/server/job.ts` and `@shivaedev/jobs/server/health.ts` when adapting job reads to admin operations.
- `@shivaedev/email`: Queue definitions returned by `defineEmailQueue` expose jobs-owned queue and worker options. Import `QueueOptions` from `@shivaedev/jobs/server/queueOptions.ts` and `WorkerOptions` from `@shivaedev/jobs/server/workerOptions.ts` for explicit annotations.
- `@shivaedev/webhooks`: `webhookJob` accepts jobs-owned queue definitions. Use `QueueDefinition` from `@shivaedev/jobs/server/definition.ts` and its jobs-owned option types when annotating registered queues.
