# BetterAuth at the native RPC boundary

The native RPC stack can keep an application's existing authentication provider. An application that already resolves sessions with BetterAuth's `auth.api.getSession({ headers })` reuses it: Platform's session middleware calls that same API and provides a small request-local Effect service to handlers. Domain repositories do not need to know how authentication sessions are stored, and an Effect SQL adapter for auth is not a prerequisite.

```ts
import { authenticatedLayer, maybeAuthenticatedLayer } from "@shivaedev/platform/server/rpc-server/session.ts";
import { betterAuthSessions } from "@shivaedev/platform/server/rpc-server/adapters/betterAuthSessions.ts";
```

Use these with the shared error classes described in [errors and request context](./request-context.md). For a handler that needs the user's id, name and email, or provider account IDs, follow [reading the signed-in user](../../packages/platform/README.md#reading-the-signed-in-user) and [provider account IDs](../../packages/platform/README.md#reading-provider-account-ids) in the Platform README; applications use that profile instead of reading Better Auth's `user` or `account` tables.

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

The provider owns cookie verification, session lookup and expiry. The middleware calls the provider on every RPC invocation and supplies `Identity` only around that invocation; it never captures a user's identity while constructing a shared Layer. A valid identity is not sufficient to access a different user's resource: that ownership check remains in the handler or domain service.

The provider's Promise API is wrapped once with `Effect.tryPromise`. A missing or invalid session becomes the declared `Unauthorized` failure. Provider failures become a separate `AuthUnavailable` failure instead of silently treating an outage as a signed-out user. Neither failure serializes provider exception details to the client.

## Application decisions

Immediate revocation is a property of database-backed sessions with Better Auth's cookie cache disabled, as in the starter; a cookie cache or secondary storage may delay when a revoked session stops working, and no test covers that delay.

The middleware takes an explicit Origin policy, and `trustedOrigins` requires a decision about missing headers; see [Origin policy](./request-context.md#origin-policy). Browser deployment still needs explicit credential and cookie settings, a CSRF review and CORS behavior where applicable. Native clients and server-to-server callers need a deliberate authentication policy; allowing a missing Origin unconditionally would erase the browser boundary.

The authenticated application shell supplies `SessionBoundary` with the auth owner's session and `recheck`. When that session changes or ends, the boundary replaces or disposes its registry and subtree, clearing cached query data and drafts; see [client lifetime](./client-lifecycle.md). The middleware resolves identity for a request; the auth owner decides when to end the UI session.
