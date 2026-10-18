# BetterAuth at the native RPC boundary

The native RPC stack can keep an application's existing authentication provider. An application that already resolves sessions with BetterAuth's `auth.api.getSession({ headers })` can reuse it: native RPC middleware can call that same API and provide a small request-local Effect service to application handlers. Domain repositories do not need to know how authentication sessions are stored.

The executable evidence is [session.test.ts](../../packages/platform/src/server/rpc-server/session.test.ts). Its [shared harness](../../packages/platform/src/test-support/rpc/harness.ts) uses real BetterAuth, its signed session cookies, its own migrations and an ephemeral SQLite database through BetterAuth's supported Node SQLite configuration. The tests run through Platform's [authenticatedLayer](../../packages/platform/src/server/rpc-server/session.ts) and [betterAuthSessions](../../packages/platform/src/server/rpc-server/adapters/betterAuthSessions.ts). BetterAuth's internals may use their own SQL tooling; the application-facing framework does not expose or adopt that tooling.

Platform provides reusable middleware for this boundary:

```ts
import { authenticatedLayer, maybeAuthenticatedLayer } from "@shivaedev/platform/server/rpc-server/session.ts";
import { betterAuthSessions } from "@shivaedev/platform/server/rpc-server/adapters/betterAuthSessions.ts";
```

Use these with the shared error classes described in [errors and request context](./request-context.md).

## Reading the current user

For a signed-in handler that needs id, name and email, declare `AuthenticatedUser` from `@shivaedev/platform/rpc/middleware.ts` and read `SessionUser` from `@shivaedev/platform/rpc/identity.ts`. Merge `authenticatedUserLayer(sessions)` from `@shivaedev/platform/server/rpc-server/session.ts` beside the handler Layer. The policy's provider must return those three fields in `session.user`; Better Auth's session lookup already does. The [Platform guide](../../packages/platform/README.md#reading-the-signed-in-user) shows the complete composition.

`SessionUser` carries `{ id, name, email }` for that invocation. To include provider account IDs, pass `(headers) => auth.api.listUserAccounts({ headers })` as the second argument to `betterAuthSessions`. The optional `SessionUser.providerAccounts` array contains typed `{ providerId, accountId }` pairs; find `providerId === "github"` to read GitHub’s numeric user ID as a string, or get no match when the user has no GitHub account. Applications do not read Better Auth’s `account` table. See [provider account IDs](../../packages/platform/README.md#reading-provider-account-ids) for the composition and PostgreSQL/HTTP story evidence. The same middleware also provides `Identity` with its existing `{ id }` shape. Missing sessions fail with typed `Unauthorized`, rejected origins with `Forbidden`, and provider outages with `AuthUnavailable`. Applications use this profile instead of querying Better Auth's `user` table.

The starter uses this path in its signed-in note handlers and its `notes.whoami` query. [sessionUser.spec.ts](../../examples/starter/src/server/sessionUser.spec.ts) runs against real PostgreSQL and loopback HTTP: concurrent requests return the matching users' profiles, the profile id owns a saved note, and anonymous and signed-out requests return typed `Unauthorized` failures. It does not establish deployed browser behavior.

## Request flow

```text
BetterAuth sign-up endpoint → signed session cookie
                                       ↓
native RPC HTTP request → trusted Origin check
                       → BetterAuth getSession(headers)
                       → request-local Identity { id }
                       → handler resource-ownership check
```

The Origin check and `getSession` read the headers of the HTTP request itself, taken from `HttpServerRequest`. They do not use the `headers` argument RpcServer passes to middleware, because that argument also contains header pairs from inside each RPC message and a cross-site page can set those freely. See [transport headers](./request-context.md#transport-headers-and-message-headers).

The provider owns cookie verification, session lookup and expiry. The middleware calls the provider on every RPC invocation and supplies `Identity` only around that invocation. It does not capture a user's identity while constructing a shared Layer. A valid identity is not sufficient to access a different user's resource: that ownership check remains in the handler or domain service.

The provider's Promise API is wrapped once with `Effect.tryPromise`. A missing or invalid session becomes the declared `Unauthorized` failure. Provider failures become a separate `AuthUnavailable` failure instead of silently treating an outage as a signed-out user. Neither failure serializes provider exception details to the client.

## Proven behavior

The tests issue sessions through BetterAuth's actual sign-up HTTP handler, pass their cookies through native RPC JSON serialization, and check:

- Concurrent requests from two users receive their own request-local identity.
- A signed-in user cannot read another user's account.
- Missing and tampered cookies are rejected.
- An untrusted or missing Origin is rejected before provider lookup.
- Sign-out through BetterAuth's HTTP handler makes the retained cookie fail with typed `Unauthorized` through the package middleware.
- A persisted expired session fails with typed `Unauthorized` through the same middleware. The test backdates the database row to establish this condition without waiting for wall time.

The tests exercise real Web `Request`/`Response` handling and the native generated RPC client through an injected fetch transport. They do not open a TCP listener or simulate a browser cookie jar. The [order example](./order-example.md) separately exercises a loopback HTTP server.

Cookie caching is explicitly disabled in this example. Immediate revocation here is a database-backed session property, not a promise about every possible BetterAuth cache or secondary-storage configuration.

## Application integration still required

These tests prove the package's middleware with a BetterAuth provider, not an application migration or a deployed session configuration. An application can keep its existing BetterAuth storage while replacing an endpoint; an Effect SQL adapter for auth is not a prerequisite.

The Platform middleware takes an explicit Origin policy function, and `trustedOrigins` requires a decision about missing headers. The tests cover strict browser policies, an explicit missing-Origin allowance and a per-method policy; see [Origin policy](./request-context.md#origin-policy) for the trade-offs. Browser deployment still needs explicit credential/cookie settings, CSRF review, CORS/preflight behavior where applicable, and tests through the actual host. Native clients and server-to-server callers need a deliberate authentication policy; allowing a missing Origin unconditionally would erase the demonstrated browser boundary.

The authenticated application shell supplies `SessionBoundary` with the auth owner's session and `recheck`. When that session changes or ends, the boundary replaces or disposes its registry and subtree, clearing cached query data and drafts. The [client lifecycle guide](./client-lifecycle.md) links the rendered session-transition tests; [editing](./editing.md) describes draft ownership. The middleware resolves identity for a request; the auth owner decides when to end the UI session.

BetterAuth storage failure is mapped distinctly. The Platform middleware test closes the provider's database and checks that requests fail with `AuthUnavailable`, not `Unauthorized`. This test covers the outage response, not recovery. OAuth, session refresh cookies, cross-origin hosts and native mobile cookie persistence are outside its scope; application and deployment acceptance is tracked in the [roadmap](./roadmap.md).
