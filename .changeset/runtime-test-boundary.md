---
"@shivaedev/quality": minor
"@shivaedev/test-kits": minor
"@shivaedev/contract": minor
"@shivaedev/server": minor
"@shivaedev/sql": minor
"@shivaedev/webhooks": minor
"@shivaedev/platform": patch
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/quality`: Reject runtime packages that publish testing modules or declare test packages as shipped dependencies or peers. Findings name the package and direct helpers into `@shivaedev/test-kits`.

- `@shivaedev/test-kits`: Publish Quality rule fixtures and runner configuration, host process and controlled clock helpers, settled query observations and signed webhook delivery helpers.

### Breaking

- `@shivaedev/quality`: Testing helpers move from `@shivaedev/quality/testing/*` to `@shivaedev/test-kits/quality/*`. Import `appTestConfig`, `adapters/testProjects`, `adapters/TestOutput`, `domEnvironment.config`, `unitIoGuard.config` and `adapters/compileCache.config` from the same paths under `@shivaedev/test-kits/quality/`. Install test-kits for development. The fixture formatter module is now `quality/adapters/formatTree.ts` instead of `testing/adapters/qualityTree.ts`. Quality no longer declares test-story or Vitest as runtime peers.
- `@shivaedev/contract`: Import `settledQueries` and `SettledQueries` from `@shivaedev/test-kits/contract/settledQueries.ts` instead of `@shivaedev/contract/testing.ts`.
- `@shivaedev/server`: `testing/*` helpers move under `@shivaedev/test-kits/host/`, dropping the host prefix from filenames: use `process.ts`, `processChild.ts`, `processReadouts.ts`, `processProtocol.ts`, `ProcessError.ts` and `time.ts`. Change imports to those paths; server no longer declares test-sql as a peer.
- `@shivaedev/sql`: The worker scheduling port is `WorkerReleaseClock` from `@shivaedev/sql/WorkerReleaseClock.ts`. Replace imports and uses of `WorkerReleaseTesting`; use `hostTime` from test-kits for controlled story time.
- `@shivaedev/webhooks`: Import webhook delivery helpers and types from `@shivaedev/test-kits/webhooks/deliver.ts` instead of `@shivaedev/webhooks/server/testing.ts`. The signing adapter moves from `@shivaedev/webhooks/server/adapters/githubHeaders.ts` to `@shivaedev/test-kits/webhooks/adapters/githubHeaders.ts`.

### Fixed

- `@shivaedev/platform`: Stop declaring Vitest and Effect’s Vitest adapter as runtime peers.
- `@shivaedev/create-app`: Generated applications import runner configuration and helpers from test-kits.
