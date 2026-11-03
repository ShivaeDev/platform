---
"@shivaedev/jobs": minor
"@shivaedev/create-app": patch
---

### Fixed

- `@shivaedev/jobs`: Release the jobs engine client when acquisition is interrupted, including pending shared-client acquisitions. Keep the client alive until its final owning Scope closes.
- `@shivaedev/jobs`: Log a tagged shutdown error when cleanup after a failed startup also fails, while preserving the startup error for callers.
- `@shivaedev/create-app`: Generate apps with the jobs factory imported from its adapter path so they compile with the scoped jobs engine.

### Breaking

- `@shivaedev/jobs`: Import `defaultClientFactory` from `@shivaedev/jobs/server/adapters/defaultClientFactory.ts` instead of `@shivaedev/jobs/server/defaultClientFactory.ts`. Its signature and the public jobs types are unchanged.
