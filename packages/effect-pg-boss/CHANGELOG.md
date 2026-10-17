# Changelog

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
