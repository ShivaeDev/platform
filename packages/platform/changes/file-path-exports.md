### Breaking

- Every module's import path is now its path under `src/`. Server modules gain a `server/` prefix and keep their file names, for example `server/appHost.ts`, `server/rpc-server/boundary.ts`, `server/better-auth/rowAdapter.ts`, `server/runtime/makePlatform.ts` and `server/testing/makePlatformIt.ts`. `errors/rejected-field.ts` becomes `errors/rejectedField.ts`.
