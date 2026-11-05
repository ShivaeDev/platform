---
"@shivaedev/sql": minor
---

### Breaking

- Import `WorkerRelease` from `@shivaedev/sql/worker-release/service.ts`. Its Layer owns the release gate and exposes traced `register` and `setActive` operations. Import the owned-state helpers from `worker-release/initialize.ts`, `worker-release/register.ts` and `worker-release/setActive.ts` when using them directly; keep `initializeWorkerRelease` and `registerWorkerRelease`, and rename the activation helper import from `setWorkerReleaseActive` to `setActive`. Prefer `WorkerRelease.layer` over constructing state directly; initializer state now holds a native `lock` semaphore and registered Effects.
- Run `makeWorkerRelease()` in a scope. It builds the gate through `WorkerRelease.layer` and keeps its `{ service, setActive }` result.
- Direct callers of `listenForChanges` pass only channel and timing settings and provide `SqlClient`, `Reactivity`, `PostgresChangeListener` and `PostgresChangeResync` in the environment. `postgresChanges(options)` supplies these dependencies internally and keeps its existing single-Layer API.
