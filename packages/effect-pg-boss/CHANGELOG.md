# Changelog

## 0.14.0 - 2026-10-19

### Added

- The jobs service lists a queue's failed jobs with `failedJobs(queue, { limit, cursor })` and the jobs in its dead-letter queue with `deadLetteredJobs(queue, { limit, cursor })`, newest first in pages with an opaque cursor. Each entry carries the job's ID, queue, state, attempt and retry counts, UTC times, the output pg-boss stored, and `data` decoded by the queue's Schema; invalid stored data fails with `PgBossPayloadError`. Dead-letter entries add the original job's ID and error. A failed entry's ID can be passed to `retry`.

## 0.13.0 - 2026-10-19

### Added

- Quality's `manifests/exports-shape` rule checks exports at the package root and in workspace members by default. Modules use one file-preserving TypeScript wildcard with matching source, types and runtime targets; root entries, exact non-code assets, package metadata and null blocks are allowed.

### Breaking

- Quality's Biome preset moves from `@shivaedev/quality/biome` to `@shivaedev/quality/biome/preset.json`. Change the `extends` entry in your Biome config to the new path; the old alias is removed. TypeScript preset paths are unchanged.
- `@shivaedev/effect-pg-boss`, `@shivaedev/effect-test-sql`, `@shivaedev/local-postgres` and `@shivaedev/test-story` expose server modules at their file paths. Add `/server/` after the package name in imports, for example `@shivaedev/test-story/server/storyKit.ts`. The shortened paths are removed; internal server modules remain blocked.
- Work Board moves `@shivaedev/work-board/client/client.ts` to `@shivaedev/work-board/browserClient.ts`; change browser-client imports to that file path. `@shivaedev/work-board/client/document/View.ts` is removed: consume document queries with your own renderer, or use the bundled Board browser UI. The client bundle stays private and the old export overrides are removed.

## 0.12.0 - 2026-10-18

### Added

- Export `QueuePolicy` as the pinned pg-boss policy literals. Singleton queue definitions require `key: (payload) => string`, evaluated from the decoded payload when enqueueing. Related tagged-union job kinds can share one entity key: PostgreSQL allows one active job per key, other keys can run in parallel, and jobs waiting to retry or sent to the dead-letter queue leave the key available. Singleton does not guarantee ordering; applications keep handlers idempotent and guard writes against stale sources.

### Breaking

- `defineQueue` rejects unknown policy strings and requires `key` for `queue.policy: "singleton"`. Move per-job `singletonKey` options into the queue definition's key callback and remove them from `enqueue` calls for singleton queues. Ordinary queues retain native send options. Let `enqueue` infer its type arguments, or supply the queue-definition type as its third type argument in explicit generic calls.

## 0.11.0 - 2026-10-18

### Added

- Fail a queue or scheduled handler with `RetryAt({ at, reason })` from `definition.ts` to defer the same job until a UTC time without spending a retry, changing its payload or singleton key, or calling `onError`. A deferred attempt ends its span OK with a `job.deferred` event. The exported `QueueOptions` type adds `maxDeferrals`, and queue and schedule definitions expose its resolved value. `queue.maxDeferrals` defaults to 10 per job; subsequent deferrals fail normally. Deferred jobs use the polling backstop, including with `notify: true`.
- Inspect waiting deferrals with the testing controller's `deferred(queue)`, returning `{ at, reason }[]`, and pull them forward with `runDeferredNow(queue)`. Both integrate with the controller's revision and change notification controls.
- Deferral counts survive native expiry and heartbeat failures. Automatic migrations and `installPgBossSchema` install the adapter's durable counter table alongside the pg-boss schema.
- Stately jobs sharing a singleton key can defer together without colliding or spending retries, and resume one at a time. Waiting deferrals use the `effect-stately-deferred` policy in native job metadata; an adapter-installed database trigger restores `stately` when claimed.

## 0.10.1 - 2026-10-18

### Fixed

- Wake workers when a failed job's retry delay ends instead of waiting for the polling backstop, including idle siblings when another worker in a concurrent registration is busy. Pending wakes are canceled when the worker Layer's scope closes. Custom clients can supply the optional `PgBossClient.notifyWorker` method to enable retry wakes and `PgBossClient.getWipData` to wake every native worker in the registration.

## 0.10.0 - 2026-10-18

### Added

- `installPgBossSchema(options?: PgBossSchemaOptions)` in `schema.ts` installs or upgrades the pg-boss schema through an Effect SQL client without starting workers or schedules. Use it in a test template fixture or release step, then start jobs Layers with `migrate: false`. Failures use `PgBossError` with the new `"install"` operation. Retrying a failed concurrent upgrade rebuilds missing and invalid managed indexes even when the schema version has already committed.

## 0.9.0 - 2026-10-18

### Added

- Export `testing.ts` with `makePgBossTesting`, `testRetryPolicy`, `PgBossTesting` and `PgBossTestingOptions`, plus `PgBossTestingError` from `error.ts`. Story kits can read Schema-decoded jobs, fail the next send, expire a selected attempt, set immediate retries, check batch budgets and schema versions, and wait for local queue changes or worker idleness without application SQL or timer polling.
- Expiry rules stay with each successfully sent job, and native terminal worker timeouts wake queue-change waiters even when a handler promise stays pending.

## 0.8.1 - 2026-10-18

### Changed

- `PgBossError` has a message that names the operation, the queue and the original error's class and code, such as a PostgreSQL SQLSTATE, without the redacted original message. A registration failure names the queue it was preparing.

### Fixed

- Registration creates a queue again, up to six times with a short backoff, when PostgreSQL rolls the creation back as a deadlock victim (SQLSTATE `40P01`). A partitioned queue created while other queues in the schema have traffic no longer fails Layer acquisition.
- Observe pg-boss connection errors throughout startup and shutdown, and log administrator-terminated connections at debug while preserving query failures and application error callbacks.
- Keep observing idle errors from closing sockets after shutdown, when shutdown fails, and when `stop({ close: false })` leaves the pool open.

## 0.8.0 - 2026-10-17

### Added

- `JobContext.remainingBudget` is an `Effect.Effect<Duration.Duration>` that reads the time left until the fetched job's expiry deadline, clamped to zero.

### Fixed

- Bound queue and scheduled handlers by each job's pg-boss `startedOn` plus `expireInSeconds`, including time spent waiting in a batch. Skip jobs whose window has passed and interrupt running Effects at their deadline, leaving interrupted and unstarted jobs for pg-boss expiry and retry. Worker registration requests start-time metadata even when `includeMetadata: false` is supplied.

## 0.7.1 - 2026-10-17

### Added

- Custom `PgBossClient` factories can supply optional native `complete` and `fail` methods. Queue and schedule worker registration requires both capabilities and fails with a registration `PgBossError` when either is absent; producer-only clients do not need them.

### Fixed

- Settle each queue and scheduled job separately through pg-boss, recording typed failures and defects on only the failed job. In 0.7.0, one failing handler failed and retried the whole fetched batch, spending unrelated jobs’ retries and rerunning successful handlers. Batches still drain with `burstWhenBatchFull`. Interruption leaves unprocessed jobs to pg-boss expiry.

## 0.7.0 - 2026-10-17

### Changed

- Queue and schedule workers default to native pg-boss `batchSize: 10` and `burstWhenBatchFull: true`, draining full batches immediately instead of waiting for the notification polling backstop. Native worker options still override the defaults, including batch size and local concurrency. Handlers run sequentially within each batch; pg-boss retries a rejected batch together.

### Fixed

- `PgBossDefinition.layer` supplies its own jobs service to queue handlers and scheduled effects through the scoped Effect context. Handlers can enqueue follow-ups to worker or producer-only queues using that same client. Only the owning identifier is removed from the Layer's input requirements; other services remain typed. Startup creates every declared queue before starting consumers.

## 0.6.1 - 2026-10-17

### Fixed

- Run each queue and scheduled job attempt inside a root consumer span named for its queue, with job identity, attempt and retry-count attributes and handler failures. Handler steps share that job trace.
- Persist the enqueueing Effect span context in pg-boss job data and link the job span to it. Handlers and `getJob` still decode the original payload Schema; direct pg-boss data readers see an envelope for traced sends.

## 0.6.0 - 2026-10-17

### Added

- `PgBossService.counts(queue)` returns live `QueueCounts` without waiting for the pg-boss monitor; `health` keeps using cached counts.
- `PgBossService.getJob(queue, id)` returns optional job metadata with Schema-decoded payloads and decoding service requirements. `PgBossService.retry(queue, id)` reprocesses failed or retry-waiting jobs under their original ID.
- `PgBossQueueOptionsError` identifies immutable queue option conflicts during Layer acquisition. Custom `PgBossClient` factories can provide optional native `findJobs`, `retry`, `update`, `getDb` and `updateQueue` capabilities for the new operations.

### Fixed

- Queue and schedule definitions accept pg-boss's full `Queue` options except the owned name and dead-letter setup, including notification delivery, policy, partitioning, heartbeat and backlog warnings.
- Startup reconciles declared mutable queue settings through `updateQueue`, including expiry and retry limits, so they reach existing queues after restart.

## 0.5.0 - 2026-10-13

### Added

- `Jobs.layer({ jobs: [Queue] })` registers a queue definition for producers without starting a worker. Its queue appears in health results and uses the same retry and dead-letter settings as a worker registration.

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`.

## 0.4.0 - 2026-10-12

### Changed

- Explain the jobs boundary in a package north star, agent guidance, usage guide and roadmap, and publish the guide and `docs/` with the package.
- Build package JavaScript, declarations and source maps with TypeScript 7.

### Fixed

- Preserve the literal identifier of each `makePgBoss(identifier)` in its service and Layer types, so a Layer for another jobs definition leaves the required service unprovided at compile time. This is breaking only for code that names the shared `PgBossIdentifier` type; use the definition's literal identifier instead.

## 0.3.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module outside `internal/` (`src` under the `source` condition, `dist` otherwise), and `"./internal/*": null` keeps `internal/` modules private, so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-pg-boss`: `@shivaedev/effect-pg-boss/client.ts` (`PgBossClient`, `PgBossClientFactory`), `@shivaedev/effect-pg-boss/definition.ts` (`DefineQueueOptions`, `DefineScheduleOptions`, `defineQueue`, `defineSchedule`, `JobContext`, `JobPayloadSchema`, `JobRegistration`, `QueueDefinition`, `QueueWorker`, `ScheduleDefinition`, `ScheduledWorker`), `@shivaedev/effect-pg-boss/error.ts` (`PgBossError`, `PgBossOperation`, `PgBossPayloadError`), `@shivaedev/effect-pg-boss/health.ts` (`deadLetterQueueName`, `JobsHealth`, `QueueHealth`), `@shivaedev/effect-pg-boss/service.ts` (`makePgBoss`, `PgBossDefinition`, `PgBossLayerOptions`, `PgBossService`)
- `PgBossClient` and `PgBossClientFactory` live in `client.ts`, moved out of `internal/` because they are public.

## 0.2.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Validate packed consumers and executable bins through the shared workspace gate.

- Replace JSDoc blocks with a short reason comment, so the package passes the comment rules of `@shivaedev/quality`.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.2.0 - 2026-09-26

### Changed

- **Breaking:** Replace `developmentCacheKey` with `clientCacheKey`. The Layer
  no longer reads `NODE_ENV`; passing a key always enables client reuse, so pass
  it only in the environments that should share a client. `undefined` disables
  reuse.
- Type the `PgBossClient.work` handler with `Job<unknown>` instead of a
  caller-chosen payload type; each queue's schema decodes the payload.

## 0.1.3 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.

## 0.1.2 - 2026-08-12

### Changed

- Require Effect 4.0.0-rc.108. The 4.0 release candidate starts the stable line,
  so consumers pick up the compatibility promise the betas did not carry.

## 0.1.1 - 2026-08-12

### Changed

- Require Effect 4.0.0-beta.107, so applications can depend on packages such as
  `@effect/platform-node` that are only published against the current beta line.

## 0.1.0 - 2026-08-03

### Added

- Add Effect services for typed pg-boss queues, Schema-decoded workers,
  scheduled jobs, retry and dead-letter setup, enqueueing, health checks, and
  scoped client lifecycle management.
