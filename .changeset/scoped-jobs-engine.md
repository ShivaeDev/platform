---
"@shivaedev/jobs": minor
---

### Fixed

- Release the jobs engine client when acquisition is interrupted, including pending shared-client acquisitions. Keep the client alive until its final owning Scope closes.

### Breaking

- Import `defaultClientFactory` from `@shivaedev/jobs/server/adapters/defaultClientFactory.ts` instead of `@shivaedev/jobs/server/defaultClientFactory.ts`. Its signature and the public jobs types are unchanged.
