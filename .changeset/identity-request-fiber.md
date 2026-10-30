---
"@shivaedev/identity": minor
---

### Fixed

- Run mounted session admission and session permission enrichment in the request fiber so request spans, log annotations and interruption survive policy checks.

### Added

- Export `SessionUserSchema` from `identity.ts`, `IdentityFailures` from `middleware.ts`, and `providerFailure` from `server/providerFailure.ts` as the shared user description, middleware failure union and redacted provider-failure mapper.

### Breaking

- `mounted.admittedSessions(lookup)` now returns an Effect `SessionProvider`. Assign it directly to `sessions.provider` instead of wrapping it with `betterAuthSessions`, or use `mounted.sessions` for the default lookup and mounted roles. Provide the application's Config provider to the server Layer for request-time account checks and to explicit revocation workflows; revocation also uses the caller's environment.
- Import `trustedProxyRanges` from `server/trustedProxyRanges.ts` instead of `server/local.ts`, and `proxyRanges` from `server/proxyRanges.ts` instead of `server/trustedProxy.ts`. The forwarding exports have been removed.
- `sessionPermissions` now returns an Effect instead of a Promise. Yield it in the caller's Effect workflow.
- `server/sessionProfile.ts` has been removed. Decode or project profiles with `Schema.decodeSync(SessionUserSchema)` from `identity.ts`.
