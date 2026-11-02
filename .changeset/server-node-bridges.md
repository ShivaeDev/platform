---
"@shivaedev/server": minor
---

### Breaking

- Move Node bridges under adapters. Replace imports from `@shivaedev/server/runtime/makePlatform.ts`, `@shivaedev/server/node-http/subscriptionSignal.ts` and `@shivaedev/server/nodeHttpServer.ts` with `@shivaedev/server/adapters/makePlatformRuntime.ts`, `@shivaedev/server/adapters/subscriptionSignal.ts` and `@shivaedev/server/adapters/nodeHttpServer.ts` respectively. Runtime types remain in `@shivaedev/server/runtime/types.ts`.

- `rerunQuery` exposes the queried group's handler services and read-policy services in its Effect requirements. Provide the application handler layer and the read-policy services before running a rerun.

### Fixed

- Query reruns retain their native RPC handler service requirements and declared failures through read authorization and live subscriptions.
