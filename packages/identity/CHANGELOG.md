# Changelog

## 0.30.2 - 2026-11-07

### Changed

- Update `@shivaedev/access` from 0.6.0 to 0.6.1.
- Update `@shivaedev/changes` from 0.11.0 to 0.11.1.
- Update `@shivaedev/contract` from 0.43.0 to 0.43.1.
- Update `@shivaedev/errors` from 0.10.0 to 0.10.1.
- Update `@shivaedev/rate-limit` from 0.6.4 to 0.6.5.
- Update `@shivaedev/service` from 0.8.0 to 0.8.1.
- Update `@shivaedev/sql` from 0.46.0 to 0.46.1.

## 0.30.1 - 2026-11-07

### Changed

- Update `@shivaedev/rate-limit` from 0.6.3 to 0.6.4.
- Update `@shivaedev/sql` from 0.45.0 to 0.46.0.

## 0.30.0 - 2026-11-06

### Added

- Carry the exact trusted-origin allow-list with the session origin policy and admit declared sibling origins through the HTTP RPC transport guard.

## 0.29.2 - 2026-11-06

### Changed

- Update `@shivaedev/rate-limit` from 0.6.2 to 0.6.3.
- Update `@shivaedev/sql` from 0.44.0 to 0.45.0.

## 0.29.1 - 2026-11-06

### Changed

- Update `@shivaedev/contract` from 0.41.0 to 0.42.0.

## 0.29.0 - 2026-11-06

### Breaking

- Generated query subscriptions return their initial authorized value. Raw subscription consumers handle `Result`; session revocation still ends established subscriptions.
- Import the client IP adapter from `server/better-auth/adapters/clientIpHeaders.ts` instead of `server/better-auth/adapters/clientIp.ts`.

## 0.28.0 - 2026-11-05

### Breaking

- Import `AccountClock` from `server/account-clock/service.ts` and `AccountPreferencesStore` from `server/account-preferences/service.ts`. Register `accountPreferencesStore` from `server/account-preferences/store.ts` instead of `AccountPreferencesStore.layer`; it supplies the yielded preferences repository while retaining one SQL-backed Layer to provide.
- Import `accountRoleSeed` from `server/better-auth/adapters/accountRoleSeed.ts` and `currentSessionContext` from `server/adapters/currentSessionContext.ts`; their signatures and behavior are unchanged.
- Import `permissionRoute` from `server/adapters/permissionRoute.ts` and pass an Effect handler instead of a request callback: `permissionRoute(permission)(handlerEffect)`. Yield `HttpServerRequest.HttpServerRequest` in the handler to read the request. Register the returned Effect directly with `HttpRouter`; import `permissionLayer` from `server/permissionLayer.ts`.

## 0.27.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. `localOwner` and `machineTokens` require `SecureRandom` and `Digest` from `effect/crypto` instead of `Crypto`; the server host provides both.

## 0.26.3 - 2026-11-05

### Changed

- Update `@shivaedev/contract` from 0.37.0 to 0.38.0.

## 0.26.2 - 2026-11-05

### Changed

- Update `@shivaedev/contract` from 0.36.1 to 0.37.0.
- Update `@shivaedev/rate-limit` from 0.5.2 to 0.5.3.
- Update `@shivaedev/sql` from 0.40.0 to 0.41.0.

## 0.26.1 - 2026-11-04

### Changed

- Update `@shivaedev/rate-limit` from 0.5.1 to 0.5.2.
- Update `@shivaedev/sql` from 0.39.0 to 0.40.0.

## 0.26.0 - 2026-11-04

### Added

- `betterAuthMount` accepts `{ clientIp: "railway" }` to select `X-Real-IP` for session addresses and auth rate limiting, ignoring `X-Forwarded-For` and overriding `AUTH_CLIENT_IP_HEADER`. Forwarded addresses still require a peer allowed by `TRUSTED_PROXY`; otherwise, or without `X-Real-IP`, the connection address is used.

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.25.0 - 2026-11-04

### Added

- Auth emails accept per-kind `windows` overrides, falling back to the existing `window` and its one-minute default.
- Declare local demo personas with `defineSeed`: find or create password users, assign their application roles and run an Effect as each user. Non-local database URLs are refused before connecting.
- Provision password users through `UserProvisioning` and `betterAuthUserProvisioning`, reusing accounts by email without replacing their profile or password.
- Compose domain-owned user data export registrations into one typed account export. Check PostgreSQL foreign keys before exporting and report user-referencing tables that have no registration.
- Register Better Auth profile, linked-account and session data for export without passwords or authentication tokens.

### Fixed

- Preserve Better Auth email continuations in the app link's `callbackURL`, accepting only continuations on the configured app route's origin.
- Expire auth test sessions relative to the Effect clock so controlled-clock stories agree with session sweeps and the auth provider.
- Enable native Better Auth database joins by default so interrupted session lookups release PostgreSQL queries without fallback join console errors or account ids. Explicit `advanced.database.joins` options still take precedence.

## 0.24.0 - 2026-11-04

### Added

- store account timezone, locale and units through authenticated preference contracts. Browser sign-in capture preserves subsequent edits.
- provide an account clock with a configurable local day start and DST-aware logical days and half-open day ranges.

### Breaking

- import `AccountDayStart` and `LogicalDay` from `@shivaedev/identity/server/account-clock/settings.ts`. `server/AccountClock.ts` exports the service only.
- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.23.1 - 2026-11-04

### Changed

- Support externally migrated Better Auth tables as a transition to identity's frozen auth migrations. Run `assertBetterAuthSchema` before `betterAuthMount` at startup to refuse schema drift with typed diagnostics naming missing tables or columns.

## 0.23.0 - 2026-11-04

### Added

- Identity provides `selfSubject`, `accountSubject` and a branded `Subject` service. Services can read the session user independently of the account being acted on; delegated accounts require the permission's `any` grant.

## 0.22.1 - 2026-11-03

### Changed

- Update `@shivaedev/contract` from 0.33.0 to 0.33.1.
- Update `@shivaedev/rate-limit` from 0.3.1 to 0.3.2.
- Update `@shivaedev/sql` from 0.35.0 to 0.36.0.

## 0.22.0 - 2026-11-03

### Added

- Add `localOwner` for loopback applications to hand a process-local owner credential to their own client and resolve the owner through the existing session, viewer and permission middleware.
- Add PostgreSQL-backed scoped machine credentials with `machineTokenMigration` and `machineTokens`. Application access roles grant each scope's permissions; live lookups refuse revoked credentials on the next request and during open live-query revalidation. HTTP bearer and WebSocket first-frame authentication use the existing transports.

## 0.21.0 - 2026-11-03

### Breaking

- Move `signedInUser`, `signInAgain`, `passwordUser` and `storedProviderAccounts` from `@shivaedev/identity/server/better-auth/testing.ts` to `@shivaedev/test-kits/identity/adapters/betterAuth.ts`. Move `testUserEmail` and `signedSessionToken` from `@shivaedev/identity/server/better-auth/adapters/testingCredentials.ts` to `@shivaedev/test-kits/identity/adapters/testingCredentials.ts`. Add test-kits as a development dependency.

## 0.20.0 - 2026-11-03

### Added

- Browser client adapters expose Better Auth calls, queries and session reads as Effects, with typed failures and session permission decoding.
- Reject an undeclared `defaultRole` when mounting Better Auth with a role set. Startup fails with a typed `UndeclaredDefaultRole` error that names the role instead of assigning it to new users.
- `changeEmail` from `client/adapters/changeEmail.ts` wraps a Better Auth client with an Effect call that requires the current password and returns typed auth failures.
- Add the `UserDirectory` port for paged users, role reads and guarded assignments, and account names. Provide `betterAuthUserDirectory` with the application's role set, SQL Layer and Better Auth options to honour custom models and field mappings.
- Export `userKeys` and `roleKeys` from `@shivaedev/identity/users.ts`. Role assignments publish the affected user and role keys after commit.
- `passwordUser` accepts `passwordHash` to store a precomputed credential while sign-in still verifies the supplied password.
- Add the `betterAuthMount` provider-only preset to close email/password, magic-link and Better Auth admin HTTP endpoints, omit provider tokens from account writes and disable cookie caching. Apps can explicitly reopen individual preset endpoints with `enabledPaths`.
- Declare identity's refusal wire codes once and map policy denial to `SIGN_IN_REFUSED` and policy or account-role-seed failure to `AUTH_UNAVAILABLE` in `authCall`.
- Accept application code literals as `authCall`'s second argument, preserving database-hook and email-delivery codes in its closed failure union. `AuthFailure.withCodes` supplies a native schema for the extended union.

### Changed

- Publish declared command changes and recover failed publication through `CommandPublication`, preserving the committed command result and its bounded publication retries.
- `signedInUser`, `signInAgain` and `passwordUser` work with the mounted host's own auth without installing a testing plugin or creating another auth instance. Minted sessions run the mounted session hooks and account role seed.

### Fixed

- Describe authentication email recipients with their public `id`, `email` and `name` fields without exposing Better Auth's `User` type.
- Resolve OAuth grant subjects whose temporary ban has expired by Effect Clock. Active bans and bans without an expiry continue to refuse access.
- Mount Better Auth routes under the configured `basePath`, including session permissions and native session replacement.
- Return application email-delivery refusals from mounted HTTP requests even when Better Auth catches the delivery error internally.

### Breaking

- Remove `@shivaedev/identity/server/commandChanges.ts` and its `commandChanges(effect, rpc, payload)` export. Session, permission and tracing middleware no longer publish command changes. Remove command wrappers from custom authentication middleware and supply only the validated viewer and session. Applications using `appHost` get command publication automatically. Custom hosts compose `guardCommands(group)` and `commandGuardLayer(publishCommand)` from `@shivaedev/contract/CommandGuard.ts` with `publishCommand` from `@shivaedev/server/publishCommand.ts`; provide the changes publication port for the chosen transport.
- Consumers observing role assignments through the former `admin.users` change collection must read `userKeys.list` or `userKeys.item(userId)` from identity. Role readers can use `roleKeys.item(userId)`. Pass these typed keys through `readKeys` when subscribing directly to Reactivity.
- `signedInUser` and `signInAgain` require the native auth cookie, secret and base URL context instead of only the testing plugin's helpers. Pass the host's `mounted.auth` directly; remove the separate testing auth instance and its `testUtils()` plugin.
- Auth email messages carry `url` and every `token` as Effect `Redacted<string>`. Apps must use `Redacted.value(message.url)` and `Redacted.value(message.token)` when rendering email content or submitting tokens, and pass the wrapped values directly to redacted queue fields.
- Replace `OauthGrants.resolveSubject(userId, clientId)` with `resolveGrant(grantId, userId, clientId)`, which returns an optional `{ user, scopes }` containing current grant scopes. Custom service implementations must look up the exact grant and verify its user and client. For custom stores, assign each stored grant an immutable unique ID, preserve it when scopes change, and allocate a fresh ID after revocation. Keep existing Better Auth consent rows and their IDs; no database migration is required. Never reuse a deleted grant ID when importing stored grants. Token issuers must include the consent ID as `grant_id`; `betterAuthOauthProvider` and `mcpProvider` do this automatically.
- `userProfiles` takes a `UserProfileStorage` port instead of a Better Auth instance. Replace `userProfiles(mounted.auth, ids)` with `userProfiles(mounted.profiles, ids)`, or supply an Effect-based `findByIds` implementation. Its import path and profile result shape stay the same.
- `betterAuthMount` now waits for the auth context and its schema check during scoped acquisition, failing with `AuthUnavailable` and logging the redacted provider cause when either fails. Apply auth migrations before building the mount Layer, handle this typed startup failure, and remove application readiness wrappers.
- Auth email limits now use PostgreSQL exclusively and share one per-account, per-kind window across mounts and restarts. Apps configuring `betterAuthMount` with `emails` must provide their PostgreSQL Layer (`SqlClient` and `Reactivity`) to the mount and include `postgresMigration` from `@shivaedev/rate-limit/adapters/postgresMigration.ts` in their numbered migration loader before starting the app. Remove imports of the deleted `server/better-auth/emailWindow.ts` helper. Request rate limits still use the app's supplied store.
- `sessionKeyContext` and the `@shivaedev/identity/server/sessionKeys.ts` module are removed. Import `resolveChanges` from `@shivaedev/identity/server/resolveChanges.ts` instead. `resolveChanges` now returns the authorized subscription directly, instead of `{ subscription, context }`; pass that result to `subscribe`. Keep request-local identity for read policy and data filtering. Session-scoped queries declare ordinary reads without additional session keys, and shared keys may trigger policy checks for several accounts.
- Identity's session and permission middleware now supply `CurrentViewer` and validate sessions without authorizing reads. Custom hosts using these layers must install `ReadPolicyGuard` as above. Custom authentication middleware on the application host must provide `CurrentViewer` from the resolved session instead of calling `authorizeReads`; the host performs authorization. Stock `appHost` users need no configuration changes.
- Exhaustive `AuthFailureCode` mappings must add `SIGN_IN_REFUSED` and `AUTH_UNAVAILABLE`. Handle declared application codes in the extended union returned by calls that pass application code literals.

## 0.19.0 - 2026-11-02

### Added

- Identity provides the `OauthGrants` environment service and the `betterAuthOauthGrants` Layer from `@shivaedev/identity/server/better-auth/adapters/oauthGrants.ts`. List client grants, revoke one client or all clients, and resolve admitted subjects with live consent through this service.
- Identity exposes `currentSessionContext` to recheck an authenticated stream's session and refresh its existing `SessionUser` and `SessionUserWithProviderAccounts` services.

### Breaking

- The optional `@better-auth/oauth-provider` peer belongs to identity. MCP's Better Auth adapter uses identity's provider edge exports for resource configuration and discovery; core modules still require no optional peers.
- Import Better Auth integration modules from `@shivaedev/identity/server/better-auth/adapters/` instead of `server/better-auth/`: `mount.ts` (`betterAuthMount`, `BetterAuthMountOptions`), `bearerSessions.ts` (`BearerSessionsOptions`, `withBearerSessions`, `hasSessionCookie`, `sessionHeaders`, `cookieSessionResponse`), `clientIp.ts` (`PEER_IP_HEADER`, `clientIpHeaders`), `columnDrift.ts` (`authColumnDrift`), `closeRoleEndpoints.ts` (`closeRoleEndpoints`), `migrationPlan.ts` (`betterAuthMigrationPlan`, `authMigrationSql`), `tables.ts` (`AuthTableOptions`, `tables`), `migrate.ts` (`migrateBetterAuth`), `assertSchema.ts` (`assertBetterAuthSchema`, `BetterAuthSchemaDrift`) and `mountedSessions.ts` (`mountedSessions`). Their names and arguments stay the same; the old paths are removed.
- Import `generateBetterAuthMigration` from `@shivaedev/identity/server/better-auth/adapters/migrations/generate.ts` instead of `server/better-auth/migrations/generate.ts`.
- Import `localRpcGuard`, `localTransport`, `loopbackOnly`, `sameOrigin` and `trustedProxyPeer` from `@shivaedev/identity/server/adapters/local.ts`; `proxyRanges` and `addProxyAddress` from `server/adapters/proxyRanges.ts`; `TrustedProxy`, `proxyAddresses` and `proxyMatches` from `server/adapters/trustedProxy.ts`; and `trustedProxyRanges` from `server/adapters/trustedProxyRanges.ts`. The corresponding paths directly under `server/` are removed.
- Import `trustedOrigins` from `@shivaedev/identity/server/adapters/trustedOrigins.ts`. Keep `OriginPolicy`, `OriginRequest`, `TrustedOriginsOptions`, `originRequest` and `transportOriginRequest` imports at `server/origin.ts`.
- `mountRoutes` in `server/better-auth/mountRoutes.ts` is now a Layer that reads `AuthRouteHandler`. Use `betterAuthMount(...).routes` for Better Auth hosting. Custom integrations provide `AuthRouteHandler` with a `handle` Effect requiring `HttpServerRequest` and compose the `mountRoutes` Layer instead of calling `mountRoutes(auth, options)`.
- `clientIpHeaders(options)` now returns an Effect function taking only the web `Request`; provide the native `HttpServerRequest` service instead of passing it as the first argument. `loopbackOnly(effect)` now accepts and returns an Effect; replace `loopbackOnly(request => handler(request))(request)` with `loopbackOnly(handlerEffect)` and provide `HttpServerRequest` around it.
- Sign-in rate limits use the host's `@shivaedev/rate-limit` Store. Provide `memoryStore` once around the host, or migrate `rate_limit_windows` with `postgresMigration` and provide `postgresStore` to share budgets across processes. Better Auth still chooses rules and client-IP keys, but its `storage` and `customStorage` options are overridden; migrate custom storage to a Store implementation. Windows now expire from the first admitted attempt, and all mounts using the same store share their budget.
- Remove `server/better-auth/memoryRateLimit.ts`. Consumers importing it must provide a shared Store to `betterAuthMount` instead.

## 0.18.0 - 2026-11-02

### Added

- Accept the application's Better Auth options in role assignment, provider-account role seeds and admin Users handlers to follow custom table and column mappings. Existing calls retain the default mapping.
- Identity mounts expose `admitsUser(userId)` to check the current sign-in policy for authenticated users on other transports, without caching rule verdicts.

### Fixed

- Interrupting a session lookup, provider-account lookup or mounted Better Auth request cancels its pending PostgreSQL query. Transaction commit, rollback and connection cleanup still finish after cancellation.
- Present SQL interruption to Better Auth as a cancelled request so an interrupted session lookup does not log an internal server error.
- Compute command invalidation once with the resolved viewer and publish declared changes for optional-auth commands, including anonymous callers.
- Preserve the configured role column when mounting stored roles, generating role-aware migrations and checking the auth schema.
- Identity checks with a zero recheck interval start an independent rule lookup even while another check for the same account is pending.

### Breaking

- MCP's `betterAuthMcp` requires `admitsUser`. Pass `admitsUser: mounted.admitsUser` from `betterAuthMount` alongside `auth: mounted.auth`. Each MCP request refuses users denied by the identity sign-in policy; existing tokens follow admission changes on the next request.

## 0.17.0 - 2026-11-01

### Added

- Identity's `betterAuthMount` accepts `onPasswordReset`, an Effect callback that runs with the host's context and composes after Better Auth's native reset callback.
- React's `permissionGuard` accepts `hidden: true` to render TanStack Router's not-found page when a signed-in viewer lacks a required permission.

### Changed

- Identity operation spans use the `Identity` prefix, including `Identity.resolveSession` and `Identity.betterAuthSession`. Adjust trace queries that used `Platform` or `PlatformRpc` names.

### Breaking

- Identity reads `SessionPolicy` from the Effect environment. Import the service from `@shivaedev/identity/server/SessionPolicy.ts` and construct one `Layer.succeed(SessionPolicy, { origin, provider, roles, streamRevalidationInterval })`, omitting optional fields as needed. Replace `SessionPolicy<TSession>` annotations with `SessionPolicy["Service"]`; provider-specific types remain on `SessionProvider<TSession>`. Remove policy arguments from session middleware constructors, `resolveSession`, `withSessionUser`, `permissionLayer`, `permissionRoute`, session lookup, rechecks and stream revalidation; provide the policy Layer to the composed readers. Profiles and provider accounts are decoded at their middleware boundaries from the shared provider.
- Server's `appHost` `sessions` option accepts that Layer and supplies it to middleware, application routes, sockets and change subscriptions. Wrap the previous policy object in `Layer.succeed(SessionPolicy, policy)`. Remove the session-shape generic from host option and factory types, and remove the policy argument from `hostChanges` and `bearerSocketRpc`.
- Admin uses identity's `SessionPolicy` directly. Replace `AdminSessions` imports and Layers with the identity service, and provide the policy once through the host instead of separately to admin handlers and documents.
- MCP's `mcpRoutes` reads `SessionPolicy` from the environment. Remove its `sessions` option and the session-shape generic from `McpOptions`; `betterAuthMcp` now returns `sessions` as a policy Layer, which can be passed to the host or supplied to MCP routes with `HttpRouter.provideRequest(oauth.sessions)` when the host also serves cookie-authenticated RPC.

## 0.16.0 - 2026-11-01

### Added

- Wire Better Auth's four email callbacks through one `emails` mount option. Deliver typed account confirmation, email-change approval, new-address confirmation, password-reset and existing-account messages with application route links and decoded new addresses.
- Throttle email delivery attempts per account and message kind within a configurable, mount-local window that defaults to one minute.
- Generated starters wire typed, throttled auth emails and provide application confirmation and password-reset routes.

## 0.15.0 - 2026-11-01

### Added

- Applications supply Better Auth database hooks as Effects through `betterAuthMount`'s `databaseHooks` option. Mounted requests provide their services, tracing and interruption; typed failures carry an application code and message, and defects remain request defects.
- Identity exposes `signInAgain(auth, userId)` to mint a fresh test session for an existing user using the caller's Effect Clock and Better Auth's configured lifetime.
- Generated apps provide session renewal verbs for HTTP visitors and browser cookies after long story clock jumps.

### Changed

- The starter's app and cookie story kits start TestClock at the present by default so Better Auth's wall-clock endpoints accept minted sessions. Stories can still choose an explicit clock.

## 0.14.0 - 2026-10-31

### Fixed

- Signed-in test sessions expire after Better Auth's configured session lifetime on Effect's Clock, so stories set decades ahead stay signed in until that lifetime ends.

### Breaking

- `signedInUser(auth, fields)` returns an Effect instead of a Promise so session minting reads the caller's Clock. In Effect code, replace `yield* Effect.promise(() => signedInUser(auth, fields))` with `yield* signedInUser(auth, fields)`. At a Promise boundary, run it with `Effect.runPromise` or the application's Effect runtime.
- Stories that also call Better Auth's auth endpoints must start TestClock at the present or a future date, because those endpoints still use the wall clock.

## 0.13.0 - 2026-10-31

### Added

- Admin pages can declare a detail path under `route.detail`. `adminDocuments` and `adminPermissionGuard` use the registered page's permission for its list and detail paths.
- Identity permission layers accept native context keys for permission middleware.
- Generate frozen PostgreSQL auth migration modules containing checked-in SQL with no Better Auth runtime dependency. Check migrated databases against current auth options and report missing tables, fields, indexes, types and nullability changes.
- Generated applications ship frozen auth migrations, retain their Quality configuration, and include a PostgreSQL story that checks their current auth options for drift.
- Baseline entries accept an optional `reason`, preserved when debt is lowered or moved.
- Identity mounts accept a configured `accountRoleSeed` to grant a role to named provider accounts at boot and sign-in through the guarded `assignRole` path. The shared `ProviderAccounts` schema accepts empty lists for seeds while `AllowedAccounts` continues to require at least one account.

### Changed

- Generated applications declare their owner seed from `AUTH_OWNER_ACCOUNTS`, with empty and unset lists granting nothing.

### Fixed

- Generated apps use admin registration for permission layers and guard each admin document by its registered page.
- Execute live auth migration DDL through the native SQL transaction connection, so a preceding migration referencing users cannot block a later auth alteration through another pool.
- Trusted `assignRole` commands work without an application Reactivity Layer and preserve an existing service for commit invalidation.

### Breaking

- Admin registrations install their pages' permission middleware and require `AdminSessions` when their handler layer builds. Provide `Layer.succeed(AdminSessions, sessions)` once at the host instead of installing each page's `permissionLayer` by hand. Missing policy fails startup with the page id and permission name.
- Declare page middleware with identity’s `permissionMiddleware` so it provides `Identity` and `SessionUser` with the shared identity failures.
- Generated apps import `ReadStatistics` from `#ReadStatistics.ts` and `StatisticsPermission` from `#modules/notes/StatisticsPermission.ts`; migrate custom imports of `#appPermissions.ts` when applying the template update.
- `authColumnDrift` decodes PostgreSQL catalog rows and can fail with `SchemaError`. Callers that restrict its error channel to `SqlError` must also handle `SchemaError`.
- `suppressions/no-double-cast` reports hidden casts outside adapters and test kits: annotated JSON parsing, unchecked reflection bindings, SQL row generics, unchecked identity overloads, Context retagging and writes to readonly or native lifecycle fields. Decode unknown data with `Schema.decodeUnknownEffect` or `SqlSchema`, check implementation return types, and preserve native Context and lifecycle types. Existing repositories can record retained findings during first adoption with a reason.

## 0.12.0 - 2026-10-31

### Added

- `migrateBetterAuth` runs Better Auth schema migrations using the database from Effect's SQL service. Applications pass auth configuration without a database pool.
- Generated applications mount roles through identity, migrate the stored default through a numbered migration, and bootstrap the first owner through `assignRole`.
- Declare the user role field and its sign-up default through identity, and adopt existing users with `migrateBetterAuth(options, { defaultRole })` without an application backfill. Fresh and upgraded PostgreSQL schemas have the same non-null text column and database default.
- Let identity's database story kit migrate schemas with or without roles, inspect the stored role column and user roles, and model a missing role.

### Fixed

- Generated applications start with no quality baseline and rely on the jobs package’s peer installation of `pg-boss`.
- Loaded editors construct their form from the supplied row without an unreachable synchronous guard.
- Refuse missing stored roles with `Forbidden` and log the migration fix instead of failing requests with a defect.

### Breaking

- `registerAdmin` reports missing or extra page handlers as defects when its handler Layer is built. Consumers that catch synchronous registration errors must instead observe Layer acquisition failures.
- Pass `defaultRole` alongside `roles` to `betterAuthMount`. Remove application-owned role `additionalFields` and Better Auth's `admin()` plugin if it was only supplying roles. Add and run a numbered `migrateBetterAuth(options, { defaultRole })` migration before deploying, then bootstrap administrators through `assignRole`.

## 0.11.1 - 2026-10-31

### Changed

- Update `@shivaedev/access` from 0.3.2 to 0.3.3.
- Update `@shivaedev/contract` from 0.28.0 to 0.29.0.
- Update `@shivaedev/errors` from 0.2.0 to 0.3.0.

## 0.11.0 - 2026-10-31

### Added

- Read a user's stored sessions with `authTestDatabase.sessionsFor(userId)`, including native Effect expiry timestamps and clock-relative expiry state. Revoked and swept sessions disappear from the readout.
- Auth HTTP spans expose the selected rate-limit address and its peer or trusted-forwarded source as `auth.rate_limit.address` and `auth.rate_limit.address_source`, including counted and refused sign-in attempts.

### Changed

- Server and the platform dependency shell no longer declare `pg` as an optional peer; its PostgreSQL integration uses the native pool from sql.

### Fixed

- Validate GitHub ids in `AllowedAccounts` as decimal digits so a login such as `github:octocat` refuses boot with a `ConfigError` naming the entry and expected format. Providers without a known format continue to accept any non-empty id.
- Better Auth sign-in callbacks run Effects in an adapter with the mount's captured context and the request's AbortSignal. Cancelling an auth request interrupts its waiting sign-in policy.
- Preserve emailed verification and password-reset redirects behind bearer sessions. Browser responses keep redirect, empty and unparseable bodies intact while parseable JSON still has session tokens removed.
- Use Effect's clock for session administration expiry filters and expired-session sweeps. Better Auth session providers also reject sessions whose returned `session.expiresAt` has passed, so stories can advance `TestClock` without rewriting stored timestamps.
- A trusted peer without the configured forwarded header falls back to its connection address in development and tests as well as production.

### Breaking

- Replace `authDatabase(url, { max, application_name })` from identity's `server/better-auth/mount.ts` with `yield* betterAuthDatabase()` from `server/better-auth/adapters/database.ts`, inside the application's SQL environment. Pass the result as Better Auth's `database`. Use sql's `postgresLayer` for standalone processes; database-backed `appHost` exposes the client inside its `application` Effect. Move connection settings to `maxConnections` and `applicationName` on that SQL Layer. Auth now shares its connection budget and lifecycle; remove direct `pg` dependencies when no longer used.
- Replace `authTestDatabase(pool)` with `yield* authTestDatabase` in identity test fixtures, provided with the application's `SqlClient`.
- When applying the generated starter update, replace `poolSizes.auth` with the shared `poolSizes.sql` budget. Auth migrations use the application SQL environment; remove custom `AuthMigrationDatabase` providers.
- Better Auth mounts require the account's current password for `/change-email`, including signed bearer sessions. Send `password` alongside `newEmail` in the HTTP JSON body; Better Auth's typed `changeEmail` method does not declare this extra field. Passwordless accounts cannot change email under this default. Applications with another account-verification policy can explicitly opt out with `betterAuthMount(options, { hardening: { requirePasswordForEmailChange: false } })`.
- Better Auth mounts revoke existing sessions after a password reset by default. Applications that intentionally retain sessions must set `emailAndPassword.revokeSessionsOnPasswordReset: false` in their Better Auth options.
- Move direct imports of `signInPolicyOptions` from `server/better-auth/signInPolicy.ts` to `server/better-auth/adapters/signInPolicyOptions.ts`. Yield the returned Effect when building the mount and remove the runner argument; the adapter captures its own context. The `PolicyRun` type is removed. Applications using `betterAuthMount` need no changes.

## 0.10.1 - 2026-10-31

### Fixed

- End open authenticated streams with `AuthUnavailable` when a session revalidation cannot reach the auth provider. Revoked sessions still end with `Unauthorized`, and live-change subscriptions use identity's shared stream revalidation.

## 0.10.0 - 2026-10-31

### Added

- List active sessions with user details and activity times, and revoke one session through the permission-guarded `identity.sessions` contract. Session revocation uses the existing request and live subscription revalidation path.
- Generated applications grant session management to their admin and owner roles.

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.
- End hosted live subscriptions with `Unauthorized` when the original session is signed out, revoked or expired, whether detected during a change hint or periodic revalidation. Keep `QueryReadDenied` for a signed-in viewer whose query policy refuses the read.
- Batch shared socket session lookups with an Effect scheduler yield so advancing `TestClock` past `streamRevalidationInterval` completes revalidation without another clock advance.
- Preserve typed session-provider failures during hint-time authorization instead of reporting them as read-policy refusals.

## 0.9.1 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.9.0 - 2026-10-30

### Added

- Access exports `AssignRoles` and `LastRoleAssigner` from `@shivaedev/access/roles.ts` for shared role policy declarations.
- Identity provides `assignRole(access, userId, role)` for trusted seeds and operator commands. Supply `SqlClient` and `Reactivity`; it returns whether storage changed and uses the Users page's PostgreSQL lock, last-role-assigner guard and commit invalidation.

### Breaking

- Identity mounts with `roles` close Better Auth's `/admin/set-role`, `/admin/update-user` and `/admin/create-user` HTTP endpoints and set its admin plugin's `adminRoles` to `[]`. Remove that setup from applications. Use the admin Users page for authorized requests and identity's `assignRole` for trusted server commands.
- Admin consumers import `AssignRoles` and `LastRoleAssigner` from `@shivaedev/access/roles.ts` instead of `@shivaedev/admin/permissions.ts` and `@shivaedev/admin/users/roles.ts`. The Users page uses identity's shared assignment operation; its permission checks, typed refusal and audit log remain.

## 0.8.0 - 2026-10-30

### Added

- Pass a provider-account lookup to a Better Auth mount's `admittedSessions(getSession, getProviderAccounts)` to read linked provider IDs through `SessionUserWithProviderAccounts` while enforcing admission and session revocation. Omitting the lookup preserves the base session shape.

## 0.7.0 - 2026-10-30

### Fixed

- Live reads and change subscriptions preserve policy failures instead of reporting read denial. Generated starter apps report notes database connection failures as `ServiceUnavailable` during the owner's live read.

### Breaking

- Query read policies declare their error and service channels with `QueryReadPolicy<Payload, E, R>`. Declare policy errors in the query's `rejections` and provide policy services when building its handler Layer. Custom subscription adapters call `querySubscription(rpc, references, viewer)` instead of resolving requests themselves. Use the native RPC type when calling `authorizeReads` or `resolveChanges` so their inferred channels include policy requirements and errors. The generated change stream includes the queries' declared rejections and service requirements; consumers handling that stream must handle those errors too.
- Admin pages install their permission's read policy for every query, preserving additional query restrictions. Remove repeated page-grant policies from individual queries and supply the page's permission middleware with the handler Layers.

## 0.6.0 - 2026-10-30

### Added

- Identity exposes a socket-scoped session coordinator for hosts to share session rechecks within a batch and drive stream revalidation from one timer.

### Fixed

- Hosted live subscriptions on one socket share hint-time session lookups and periodic session revalidation while retaining per-query read-policy checks and typed revocation failures.

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
