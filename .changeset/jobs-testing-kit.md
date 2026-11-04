---
"@shivaedev/jobs": minor
"@shivaedev/test-kits": minor
"@shivaedev/quality": patch
---

### Breaking

- `@shivaedev/jobs`: Move `makePgBossTesting`, `testRetryPolicy`, `linkedWorkerSpans` and their types from `@shivaedev/jobs/server/testing.ts` to `@shivaedev/test-kits/jobs/testing.ts`. Import `PgBossTestingError` and `PgBossWaitError` from `@shivaedev/test-kits/jobs/error.ts` instead of jobs’ error module. Add test-kits as a development dependency; jobs no longer exports testing infrastructure.

### Added

- `@shivaedev/jobs`: Advance inspection change revisions immediately after local deferral settlement, before workers continue their batch.

- `@shivaedev/test-kits`: Provide the pg-boss testing controller in test-kits, using jobs’ public client and inspection service with the real PostgreSQL engine.

### Fixed

- `@shivaedev/quality`: Recognize the test-kits controller import and its jobs stories when checking story assertions against queue storage; applications and other kits remain checked.
