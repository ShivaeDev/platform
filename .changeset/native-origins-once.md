---
"@shivaedev/identity": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/identity`: The auth declaration names a bundled native client's origins once, in `defineAuth({ nativeOrigins, options })`. From that list the mount installs Better Auth's signed bearer plugin, adds the origins to Better Auth's `trustedOrigins` (a list, a function or the default), returns them on `mounted.sessions.nativeOrigins` for `SessionPolicy`, and the session origin check admits them beside the `origin` policy. Wildcards, patterns, `null` and URLs with paths fail the mount at startup with a config error.
- `@shivaedev/identity`: `localOwner({ nativeOrigins, owner, roles })` takes the same list for a local-owner host, refuses the same malformed origins at start and puts the list on its `sessions`, so the session origin check, the RPC guard, CORS and the RPC socket upgrade admit it.
- `@shivaedev/identity`: `SessionPolicy` has an optional `nativeOrigins` field typed by the branded `NativeOrigins` schema from `@shivaedev/identity/server/NativeOrigins.ts`, so only a validated list reaches it.
- `@shivaedev/server`: `appHost` admits the origins in `SessionPolicy.nativeOrigins` through the RPC transport guard, the RPC socket upgrade and the auth routes, so an application no longer lists them for the host.

### Breaking

- `@shivaedev/identity`: `betterAuthMount`'s `bearerSessions` option is removed. Move its `origins` into the declaration: replace `betterAuthMount(AppAuth, { bearerSessions: { origins } })` with `betterAuthMount({ ...AppAuth, nativeOrigins: origins })`, or name `nativeOrigins` in `defineAuth`. Remove those origins from Better Auth's `trustedOrigins` and from the `trustedOrigins({ allow })` session policy, and spread `mounted.sessions` into `SessionPolicy`.
- `@shivaedev/identity`: `localRpcGuard(effect, trustedProxy)` from `@shivaedev/identity/server/adapters/local.ts` takes no native origin list; it reads `SessionPolicy.nativeOrigins`. Drop the third argument. `admittedSessions(gate, storage, bearer)` from `@shivaedev/identity/server/better-auth/adapters/admittedSessions.ts` takes a boolean instead of `{ origins }`. The `BearerSessionsOptions` type is removed.
- `@shivaedev/server`: `appHost`'s `nativeOrigins` option is removed; the host reads the list from `SessionPolicy.nativeOrigins`. Move the list to where the policy is made: with Better Auth, into `defineAuth({ nativeOrigins })` and spread `mounted.sessions` into the policy; for a local-owner host, into `localOwner({ nativeOrigins })` and use its `sessions`; for a hand-built `SessionPolicy`, set `nativeOrigins: yield* Schema.decodeUnknownEffect(NativeOrigins)(origins)` with `NativeOrigins` from `@shivaedev/identity/server/NativeOrigins.ts`. A host with `policy: "loopback"` has no session policy and admits no native origin.
- `@shivaedev/server`: The transport value that `hostRpcRoutes` takes (the `hostTransport` result) no longer has `nativeOrigins`, and `socketRpc(handler, policy, trustedProxy)` lost its origin list parameter. Callers drop them.
- `@shivaedev/server`: `NativeOrigins` from `@shivaedev/server/nativeClientOrigins.ts` moved to `@shivaedev/identity/server/NativeOrigins.ts`, and `nativeClientOrigins(trustedProxy, route, rpcPath?)` takes `"auth"` or `"rpc"` instead of an origin list and a mode.
