---
"@shivaedev/sql": minor
---

### Breaking

- Import `makeWorkerRelease` from `@shivaedev/sql/makeWorkerRelease.ts` instead of `@shivaedev/sql/WorkerRelease.ts`. `WorkerRelease` stays in its existing module; worker registration and release coordination behave the same.
