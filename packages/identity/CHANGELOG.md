# Changelog

## 0.5.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.5.0 - 2026-10-30

### Added

- Export `SessionUserSchema` from `identity.ts`, `IdentityFailures` from `middleware.ts`, and `providerFailure` from `server/providerFailure.ts` as the shared user description, middleware failure union and redacted provider-failure mapper.
- Access exports the `Permission` Schema and derives its type from it. Role resolution and identity session decoding use that Schema.
- Access exports `forbidden(permission)` and `unauthorized()` from `refusal.ts` for consistent permission refusals.
- Identity's `trustedOrigins` accepts an optional `sameOrigin: { trustedProxy }` policy using the transport guard's loopback and trusted-proxy authority checks. Session resolution supplies the transport peer address; RPC message headers cannot establish proxy trust.

### Fixed

- Report failures and defects masked by `rpcBoundary` through Effect's error reporters at Error severity with diagnostic redaction before returning the rejection.
- Log boundary-masked RPC failures once at ERROR with their redacted stack; keep declared rejections at INFO.
- Retry command-declared invalidation publication after the handler returns, with two bounded exponential backoffs. Exhausted retries preserve the committed result and resynchronize local live streams, then broadcast Resync to other PostgreSQL hosts when the change channel is reachable.
- Clarify that atomic record and bucket invalidation comes from the stored model and repository; command `invalidates` keys remain after-commit. No consumer API changes or migration are required.
- Run mounted session admission and session permission enrichment in the request fiber so request spans, log annotations and interruption survive policy checks.
- Generated apps accept their own forwarded HTTPS RPC requests without `PUBLIC_URL`, while refusing foreign origins. A configured `PUBLIC_URL` remains the explicit RPC origin allowlist.

### Breaking

- `mounted.admittedSessions(lookup)` now returns an Effect `SessionProvider`. Assign it directly to `sessions.provider` instead of wrapping it with `betterAuthSessions`, or use `mounted.sessions` for the default lookup and mounted roles. Provide the application's Config provider to the server Layer for request-time account checks and to explicit revocation workflows; revocation also uses the caller's environment.
- Import `trustedProxyRanges` from `server/trustedProxyRanges.ts` instead of `server/local.ts`, and `proxyRanges` from `server/proxyRanges.ts` instead of `server/trustedProxy.ts`. The forwarding exports have been removed.
- `sessionPermissions` now returns an Effect instead of a Promise. Yield it in the caller's Effect workflow.
- `server/sessionProfile.ts` has been removed. Decode or project profiles with `Schema.decodeSync(SessionUserSchema)` from `identity.ts`.
- Access, identity and React now share access's grant evaluator: an `any` grant covers an `own` check for the same permission name. An `own` grant still cannot cover an `any` check. Applications that need separate capabilities must declare separate permission names; record ownership checks still belong in `canAccess` or `requireAccess`.
- Replace `Access.requirePermission(user, permission)` with `requirePermission(yield* Access.resolve(user.role), permission)` from `@shivaedev/access/requirePermission.ts`. The new function takes a signed-in user; reject an absent session with `unauthorized()` from `@shivaedev/access/refusal.ts` before resolving its role. `requireAccess` continues to handle signed-out users itself.
- Replace identity's `requirePermission(permission)` with access's `requirePermission(yield* SessionUser, permission)`. There is no identity re-export. Admin's built-in handlers use this shared enforcement.
- Access's `requireAccess` now uses the shared permission refusal message, `Permission required: <name> (<strength>)`, instead of `Access denied: <name>`. Consumers should branch on the `Forbidden` tag.
- Identity treats an undeclared stored user role as a defect naming the role, rather than `AuthUnavailable`. RPC request tracing logs the defect and Better Auth's session endpoint returns HTTP 500. Consumers must correct the user's stored role or restore its application declaration; reserve `AuthUnavailable` handling for provider outages.
- Admin role assignment trusts its typed role input and leaves session role resolution to identity. RPC consumers need no change: the contract decodes the role. Direct callers of `changeUserRole` must decode untrusted role input with the application's `Role` schema before calling it.

## 0.4.0 - 2026-10-30

### Added

- Scope screen-driver verbs and readouts with `within(container)`, and mount named member screens with independent cookie sessions, atom registries and scoped roots through `memberScreens`.
- Create password-credential test users with Identity's `passwordUser` helper for real email sign-in stories.
- Quality accepts app migrations referencing the auth user id with `ON DELETE CASCADE` or `ON DELETE SET NULL`, while keeping auth reads and writes behind identity.
- Identity exports `userReference` from `server/better-auth/userReference.ts` so app migrations share the user table and id column names.
- Starter notes use a `user_id` foreign key with cascading deletion. A numbered migration renames the existing ownership column and adds the constraint for existing apps.

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.3.2 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.3.1 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.3.0 - 2026-10-28

### Added

- Identity exports `sweepExpiredSessions`, an Effect over the application's SQL client that deletes expired Better Auth sessions and returns the number removed without mounting auth.
- The starter worker sweeps expired auth sessions daily at midnight UTC. New apps and apps using the starter updater receive the schedule.
- `authTestDatabase(pool).expireSessions(userId)` expires only the selected user's sessions; omit the user id to expire every session.

### Fixed

- Enforce declared query read policies at the hosted RPC handler boundary, including contracts without identity middleware, whose viewer is anonymous. Query RPC error schemas include `QueryReadDenied` so native clients receive typed refusals before handlers run.
- Keep collection methods and untyped schema internals from making data parameters appear to carry callable services. Direct service implementations, nested dependency fields and service arrays remain subject to `effect/service-parameters`.

### Breaking

- Call `authTestDatabase(pool).expireSessions()` instead of yielding the `expireSessions` property directly.
- Move key imports from `@shivaedev/contract/keys.ts` to `@shivaedev/changes/keys.ts`. Declare bucket fields with `collection(name, idSchema, fields)` and publish affected buckets alongside record keys.
- Replace collection policy maps, `mergeReadPolicies`, `ReadPolicy` and `ReadPolicyMemoWindow` with each query's `readPolicy(payload, viewer)`. Declare the same query's live scope with `reads(payload, viewer)`. Bound query atoms and subscriptions refuse missing policies with a declaration error; one-off query `run` calls remain available. Denied queries refuse the entire subscription. Server adapters replace `QueryReads` and `ChangesReads` with `QueryDefinition` and `ChangesQueries`. Custom middleware calls `authorizeReads(effect, request, viewer)` and declares `MissingReadPolicy` and `QueryReadDenied` errors.
- Custom subscription adapters yield `ChangesQueries.resolve(references)`, call `querySubscription(requests, viewer)` and pass the authorized result to `makeLiveServer.subscribe(subscription, context)`. Metadata values expose `QueryDefinition.definition` and `CommandInvalidation.invalidates` instead of bare definitions and callbacks. Yield the Effect returned by `queryKeys(queries, references)` when projecting keys for a custom stream. `resolveChanges` supplies the authorized subscription in hosted applications. Changed hints can carry query positions so bindings can rerun session-scoped reads without deriving session scopes in the browser.
- Remove `appHost`'s `readPolicy` option and module policy registration. Session and permission middleware apply query policies using the current session viewer. Handle the new typed policy errors in native clients, including `QueryReadDenied` on query RPCs without identity middleware; widen explicit query error annotations accordingly.
- Replace `sessionCommandChanges` with `commandChanges` for custom session middleware. Command invalidation callbacks can receive the session viewer as their third argument. Announce viewer buckets there; background writers must explicitly publish those bucket keys after commit.
- Built-in admin queries declare their permission policies alongside their schemas and read scopes. Consumers keep supplying the existing session and permission middleware layers.
- Local Work Board and Fleet queries declare their existing loopback read access explicitly so their generated live subscriptions remain available.

## 0.2.0 - 2026-10-27

### Added

- Session hosts bound to a non-loopback address without proxy trust warn at startup to configure `TRUSTED_PROXY` or `config.trustedProxy` before forwarding RPC requests.

### Fixed

- Development auth accepts both `localhost` and `127.0.0.1` over HTTP on any port when `PUBLIC_URL` is unset. Explicit `baseURL` and `trustedOrigins` options replace those defaults.
- Auth rate limiting uses the connection peer address without a trusted proxy, separating client buckets and avoiding Better Auth's missing-client-IP warning. Trusted forwarding still takes precedence, and untrusted forwarding headers are ignored.

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/identity`: request identity and the RPC middleware declarations (`identity.ts`, `middleware.ts`, `permission.ts`), session resolution, Origin policy, trusted proxies, permission enforcement and request tracing (`server/`), and the Better Auth mount, sign-in policy and test helpers (`server/better-auth/`). The service and middleware ids now name the package (`@shivaedev/identity/Identity`, `@shivaedev/identity/Authenticated` and so on).
