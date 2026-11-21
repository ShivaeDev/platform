---
"@shivaedev/identity": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/identity`: The auth declaration names a bundled native client's origins once, in `defineAuth({ nativeOrigins, options })`. From that list the mount installs Better Auth's signed bearer plugin, adds the origins to Better Auth's `trustedOrigins` (a list, a function or the default), returns them on `mounted.sessions.nativeOrigins` for `SessionPolicy`, and the session origin check admits them beside the `origin` policy. Wildcards, patterns, `null` and URLs with paths fail the mount at startup with a config error.
- `@shivaedev/identity`: `SessionPolicy` has an optional `nativeOrigins` field typed by the branded `NativeOrigins` schema from `@shivaedev/identity/server/NativeOrigins.ts`, so only a validated list reaches it.
- `@shivaedev/server`: `appHost` admits the origins in `SessionPolicy.nativeOrigins` through the RPC transport guard, the RPC socket upgrade and the auth routes, so an application no longer lists them for the host.

### Breaking

- `@shivaedev/identity`: `betterAuthMount`'s `bearerSessions` option is removed. Move its `origins` into the declaration: replace `betterAuthMount(AppAuth, { bearerSessions: { origins } })` with `betterAuthMount({ ...AppAuth, nativeOrigins: origins })`, or name `nativeOrigins` in `defineAuth`. Remove those origins from Better Auth's `trustedOrigins` and from the `trustedOrigins({ allow })` session policy, and spread `mounted.sessions` into `SessionPolicy`.
- `@shivaedev/identity`: `localRpcGuard(effect, trustedProxy)` from `@shivaedev/identity/server/adapters/local.ts` takes no native origin list; it reads `SessionPolicy.nativeOrigins`. Drop the third argument. `admittedSessions(gate, storage, bearer)` from `@shivaedev/identity/server/better-auth/adapters/admittedSessions.ts` takes a boolean instead of `{ origins }`. The `BearerSessionsOptions` type is removed.
- `@shivaedev/server`: `appHost`'s `nativeOrigins` option is removed. Delete it; the host reads the list from `SessionPolicy`. A host with `policy: "loopback"` has no session policy and admits no native origin.
- `@shivaedev/server`: `NativeOrigins` from `@shivaedev/server/nativeClientOrigins.ts` moved to `@shivaedev/identity/server/NativeOrigins.ts`, and `nativeClientOrigins(trustedProxy, route, rpcPath?)` takes `"auth"` or `"rpc"` instead of an origin list and a mode.
