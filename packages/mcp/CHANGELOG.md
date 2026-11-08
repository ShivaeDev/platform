# Changelog

## 0.9.11 - 2026-11-08

### Changed

- Update `@shivaedev/identity` from 0.30.5 to 0.30.6.

## 0.9.10 - 2026-11-07

### Changed

- Update `@shivaedev/identity` from 0.30.4 to 0.30.5.

## 0.9.9 - 2026-11-07

### Changed

- Update `@shivaedev/identity` from 0.30.3 to 0.30.4.

## 0.9.8 - 2026-11-07

### Changed

- Update `@shivaedev/identity` from 0.30.2 to 0.30.3.

## 0.9.7 - 2026-11-07

### Changed

- Update `@shivaedev/access` from 0.6.0 to 0.6.1.
- Update `@shivaedev/errors` from 0.10.0 to 0.10.1.
- Update `@shivaedev/identity` from 0.30.1 to 0.30.2.

## 0.9.6 - 2026-11-07

### Changed

- Update `@shivaedev/identity` from 0.30.0 to 0.30.1.

## 0.9.5 - 2026-11-06

### Changed

- Update `@shivaedev/identity` from 0.29.2 to 0.30.0.

## 0.9.4 - 2026-11-06

### Changed

- Update `@shivaedev/identity` from 0.29.1 to 0.29.2.

## 0.9.3 - 2026-11-06

### Changed

- Update `@shivaedev/identity` from 0.29.0 to 0.29.1.

## 0.9.2 - 2026-11-06

### Changed

- Update `@shivaedev/identity` from 0.28.0 to 0.29.0.

## 0.9.1 - 2026-11-05

### Changed

- Update `@shivaedev/identity` from 0.27.0 to 0.28.0.

## 0.9.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together. A tool's `dependencies` are request-level in Effect 4.1.0, so `Layer.provide` of the service no longer satisfies them. Supply them through `McpServer.middleware<{ provides: Service }>()((effect) => Effect.provideService(effect, Service, value)).layer` provided to the tools layer.

## 0.8.5 - 2026-11-05

### Changed

- Update `@shivaedev/identity` from 0.26.2 to 0.26.3.

## 0.8.4 - 2026-11-05

### Changed

- Update `@shivaedev/identity` from 0.26.1 to 0.26.2.

## 0.8.3 - 2026-11-04

### Changed

- Update `@shivaedev/identity` from 0.26.0 to 0.26.1.

## 0.8.2 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.8.1 - 2026-11-04

### Changed

- Update `@shivaedev/identity` from 0.24.0 to 0.25.0.

## 0.8.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.7.1 - 2026-11-04

### Changed

- Update `@shivaedev/identity` from 0.23.0 to 0.23.1.

## 0.7.0 - 2026-11-04

### Added

- Serve native Effect toolkit layers over stdio with `mcpStdio` from `@shivaedev/mcp/stdio.ts`. The server scope owns the transport and tool handlers, including cancellation and resource cleanup.

## 0.6.3 - 2026-11-03

### Changed

- Update `@shivaedev/identity` from 0.22.0 to 0.22.1.

## 0.6.2 - 2026-11-03

### Changed

- Update `@shivaedev/identity` from 0.21.0 to 0.22.0.

## 0.6.1 - 2026-11-03

### Changed

- Update `@shivaedev/access` from 0.4.0 to 0.4.1.
- Update `@shivaedev/errors` from 0.6.0 to 0.7.0.
- Update `@shivaedev/identity` from 0.20.0 to 0.21.0.

## 0.6.0 - 2026-11-03

### Added

- Expose `authenticate` from `betterAuthMcp` so applications can distinguish an `InvalidTokenClaim` failure, with its claim name, from a refused OAuth grant. Missing or malformed required claims produce a claim diagnostic; MCP HTTP requests keep their unauthorized resource challenge.

### Fixed

- Admit a member's MCP client once their temporary ban expires, including before they sign in on the web again.
- Revoked MCP tokens stay refused after new consent. Removing `mcp` from a live grant’s scopes refuses its tokens on the next request.

### Breaking

- The MCP OAuth session policy refuses requests carrying a Cookie header, including those with a valid bearer token. Send MCP bearer credentials without cookies; keep browser cookies on cookie-authenticated RPC routes.
- The exported `bearer` verifier now fails with `InvalidTokenClaim` for missing or invalid claims instead of returning `Option.none()`. Consumers of this verifier must handle the typed failure and can read its `claim` field. The session Layer continues to answer these tokens with the unauthorized resource challenge.
- MCP tokens now carry a `grant_id` that references the exact Better Auth `oauthConsent` row. Tokens issued before this change lack that reference and are refused; clients must authorize again to obtain new access tokens. Existing refresh tokens can obtain grant-bound access tokens while their consent remains live.

## 0.5.0 - 2026-11-02

### Breaking

- MCP no longer returns `revokeClient` or `revokeAllClients` from `betterAuthMcp`. Read `OauthGrants` from `@shivaedev/identity/server/oauthGrants.ts` in an Effect and call those methods on the service. Provide `betterAuthOauthGrants({ auth: mounted.auth, admitsUser: mounted.admitsUser })` to that Effect and to `betterAuthMcp`; remove the latter's `admitsUser` option. Applications continue to authorize grant management operations.

## 0.4.0 - 2026-11-02

### Added

- Identity mounts expose `admitsUser(userId)` to check the current sign-in policy for authenticated users on other transports, without caching rule verdicts.

### Fixed

- Serve OAuth discovery at the configured issuer's discovery path, including custom and root issuers.
- Keep OAuth metadata rejections in the typed `AuthUnavailable` channel and retain the original cause of configuration, metadata and grant failures.
- Accept case-insensitive bearer authorization schemes.
- Identity checks with a zero recheck interval start an independent rule lookup even while another check for the same account is pending.

### Breaking

- MCP's `betterAuthMcp` requires `admitsUser`. Pass `admitsUser: mounted.admitsUser` from `betterAuthMount` alongside `auth: mounted.auth`. Each MCP request refuses users denied by the identity sign-in policy; existing tokens follow admission changes on the next request.

## 0.3.0 - 2026-11-01

### Changed

- Identity operation spans use the `Identity` prefix, including `Identity.resolveSession` and `Identity.betterAuthSession`. Adjust trace queries that used `Platform` or `PlatformRpc` names.

### Breaking

- Identity reads `SessionPolicy` from the Effect environment. Import the service from `@shivaedev/identity/server/SessionPolicy.ts` and construct one `Layer.succeed(SessionPolicy, { origin, provider, roles, streamRevalidationInterval })`, omitting optional fields as needed. Replace `SessionPolicy<TSession>` annotations with `SessionPolicy["Service"]`; provider-specific types remain on `SessionProvider<TSession>`. Remove policy arguments from session middleware constructors, `resolveSession`, `withSessionUser`, `permissionLayer`, `permissionRoute`, session lookup, rechecks and stream revalidation; provide the policy Layer to the composed readers. Profiles and provider accounts are decoded at their middleware boundaries from the shared provider.
- Server's `appHost` `sessions` option accepts that Layer and supplies it to middleware, application routes, sockets and change subscriptions. Wrap the previous policy object in `Layer.succeed(SessionPolicy, policy)`. Remove the session-shape generic from host option and factory types, and remove the policy argument from `hostChanges` and `bearerSocketRpc`.
- Admin uses identity's `SessionPolicy` directly. Replace `AdminSessions` imports and Layers with the identity service, and provide the policy once through the host instead of separately to admin handlers and documents.
- MCP's `mcpRoutes` reads `SessionPolicy` from the environment. Remove its `sessions` option and the session-shape generic from `McpOptions`; `betterAuthMcp` now returns `sessions` as a policy Layer, which can be passed to the host or supplied to MCP routes with `HttpRouter.provideRequest(oauth.sessions)` when the host also serves cookie-authenticated RPC.

## 0.2.4 - 2026-11-01

### Changed

- Update `@shivaedev/access` from 0.3.4 to 0.3.5.
- Update `@shivaedev/errors` from 0.4.0 to 0.4.1.
- Update `@shivaedev/identity` from 0.15.0 to 0.16.0.

## 0.2.3 - 2026-11-01

### Changed

- Update `@shivaedev/identity` from 0.14.0 to 0.15.0.

## 0.2.2 - 2026-10-31

### Changed

- Update `@shivaedev/identity` from 0.13.0 to 0.14.0.

## 0.2.1 - 2026-10-31

### Changed

- Update `@shivaedev/access` from 0.3.3 to 0.3.4.
- Update `@shivaedev/errors` from 0.3.0 to 0.4.0.
- Update `@shivaedev/identity` from 0.12.0 to 0.13.0.

## 0.2.0 - 2026-10-31

### Added

- Return `revokeClient(userId, clientId)` and `revokeAllClients(userId)` Effects from `betterAuthMcp` to delete consent and stored access and refresh tokens.
- Allow provider `scopes`, including `offline_access`, and an in-process `jwks` source for token verification.

### Fixed

- Refuse banned users and access tokens whose client consent no longer exists with the MCP unauthorized resource challenge.

### Breaking

- Custom Better Auth wrappers passed to `betterAuthMcp` must expose the native context's adapter as well as its user lookup. Pass the full Better Auth instance. Custom signed tokens must identify their OAuth client and have stored consent for that user and client.

## 0.1.11 - 2026-10-31

### Changed

- Update `@shivaedev/access` from 0.3.2 to 0.3.3.
- Update `@shivaedev/errors` from 0.2.0 to 0.3.0.
- Update `@shivaedev/identity` from 0.11.0 to 0.11.1.

## 0.1.10 - 2026-10-31

### Changed

- Update `@shivaedev/access` from 0.3.1 to 0.3.2.
- Update `@shivaedev/errors` from 0.1.3 to 0.2.0.
- Update `@shivaedev/identity` from 0.10.1 to 0.11.0.

## 0.1.9 - 2026-10-31

### Changed

- Update `@shivaedev/identity` from 0.10.0 to 0.10.1.

## 0.1.8 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.

## 0.1.7 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.6 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.5 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.4 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.3 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.2 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.1 - 2026-10-30

### Fixed

- Return 503 without an OAuth restart challenge when bearer verification cannot reach the JWKS service, and log verification failures with secrets redacted. Invalid and expired tokens still receive 401.

## 0.1.0 - 2026-10-30

### Added

- Serve native Effect toolkits on the application host with request identity and permission-based audiences through `@shivaedev/mcp`.
- Connect MCP clients through Better Auth OAuth, with protected-resource discovery and authorization challenges. Install the optional OAuth provider peer to use the edge adapter.

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.
