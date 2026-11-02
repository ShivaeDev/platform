---
"@shivaedev/vitest-rerun": minor
---

### Fixed

- Invalid Vitest command-line arguments fail attempts with `VitestRerunError` and a diagnostic naming the argument.

### Breaking

- `runAttempt` requires `VitestRunner`; provide `VitestRunner.layer` from `/adapters/VitestRunner.ts` alongside the existing Node services. Move imports of `Files` and `Task` from `/internal/snapshot.ts` to `/adapters/tasks.ts`, `junitClassname` from `/internal/junit.ts` to `/internal/junitClassname.ts`, and `RerunJunitReporter` from `/internal/junit.ts` to `/adapters/RerunJunitReporter.ts`. Reporter, coverage and snapshot-summary adapters now live under `/adapters/` instead of `/internal/adapters/`.
