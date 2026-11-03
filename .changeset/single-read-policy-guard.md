---
"@shivaedev/contract": minor
"@shivaedev/server": minor
"@shivaedev/identity": minor
---

### Added

- `@shivaedev/contract`: Contract owns `ReadPolicyGuard`, `ReadPolicyGuard.layer()` and `guardReads(group)` in `@shivaedev/contract/ReadPolicyGuard.ts`. The guard checks each ordinary query's read policy once against the request's `CurrentViewer`.

### Fixed

- `@shivaedev/server`: The application host installs the contract guard, avoiding duplicate policy evaluations after session resolution for required and optional authentication.

### Breaking

- `@shivaedev/server`: Replace the `HostedReadPolicy` type from `@shivaedev/server/hostRpc.ts` with `ReadPolicyGuard` from `@shivaedev/contract/ReadPolicyGuard.ts`. Custom hosts install `ReadPolicyGuard.layer()` and serve the group returned by `yield* guardReads(group)`, which places the guard inside identity middleware. Pass `{ websocket: true }` to the Layer constructor for WebSocket hosts; its default refuses `$changes` over HTTP.
- `@shivaedev/identity`: Identity's session and permission middleware now supply `CurrentViewer` and validate sessions without authorizing reads. Custom hosts using these layers must install `ReadPolicyGuard` as above. Custom authentication middleware on the application host must provide `CurrentViewer` from the resolved session instead of calling `authorizeReads`; the host performs authorization. Stock `appHost` users need no configuration changes.
