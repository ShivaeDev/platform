# BetterAuth at the native RPC boundary

The native RPC stack can keep an application's existing authentication provider. An application that already resolves sessions with BetterAuth's `auth.api.getSession({ headers })` can reuse it: native RPC middleware can call that same API and provide a small request-local Effect service to application handlers. Domain repositories do not need to know how authentication sessions are stored.

The executable example is [native-rpc-auth.test.ts](../../packages/platform/test/native-rpc-auth.test.ts). It uses real BetterAuth, its signed session cookies, its own migrations and an ephemeral SQLite database through BetterAuth's supported Node SQLite configuration. It adds no Platform auth adapter or storage implementation. BetterAuth's internals may use their own SQL tooling; the application-facing framework does not expose or adopt that tooling.

Platform now ships this boundary as reusable middleware: `authenticatedLayer`,
`maybeAuthenticatedLayer` from `@shivaedev/platform/rpc-server/session.ts` and
`betterAuthSessions` from `@shivaedev/platform/rpc-server/adapters/better-auth-sessions.ts`, with the shared error classes. See
[errors and request context](./request-context.md). The test described here is
still the minimal example, written without those helpers.

## Request flow

```text
BetterAuth sign-up endpoint → signed session cookie
                                       ↓
native RPC HTTP request → trusted Origin check
                       → BetterAuth getSession(headers)
                       → request-local Principal { userId }
                       → handler resource-ownership check
```

The Origin check and `getSession` read the headers of the HTTP request itself, taken from `HttpServerRequest`. They do not use the `headers` argument RpcServer passes to middleware, because that argument also contains header pairs from inside each RPC message and a cross-site page can set those freely. See [transport headers](./request-context.md#transport-headers-and-message-headers).

The provider owns cookie verification, session lookup and expiry. The middleware calls the provider on every RPC invocation and supplies `Principal` only around that invocation. It does not capture a user's identity while constructing a shared Layer. A valid identity is not sufficient to access a different user's resource: that ownership check remains in the handler or domain service.

The provider's Promise API is wrapped once with `Effect.tryPromise`. A missing or invalid session becomes the declared `Unauthorized` failure. Provider failures become a separate `AuthUnavailable` failure instead of silently treating an outage as a signed-out user. Neither failure serializes provider exception details to the client.

## Proven behavior

The test issues sessions through BetterAuth's actual sign-up HTTP handler, passes their cookies through native RPC JSON serialization, and checks:

- Concurrent requests from two users receive their own request-local principal.
- A signed-in user cannot read another user's account.
- Missing and tampered cookies are rejected.
- An untrusted or missing Origin is rejected before provider lookup.
- Sign-out through BetterAuth's HTTP handler revokes the session, even if a client retains the old cookie.
- A persisted expired session is rejected by the provider. The test backdates the database row to establish this condition without waiting for wall time.

The test exercises real Web `Request`/`Response` handling and the native generated RPC client through an injected fetch transport. It does not open a TCP listener and does not simulate a browser cookie jar. The earlier order example separately exercises a loopback HTTP server.

Cookie caching is explicitly disabled in this example. Immediate revocation here is a database-backed session property, not a promise about every possible BetterAuth cache or secondary-storage configuration.

## Application integration still required

This is an independently executable provider-boundary example, not an application migration or proof of a deployed session configuration. An application can keep its existing BetterAuth storage while replacing an endpoint; an Effect SQL adapter for auth is not a prerequisite.

The example requires an exact trusted Origin for every RPC call, including reads. This is intentionally simple for a same-origin browser application. The Platform middleware instead takes an explicit Origin policy function, and `trustedOrigins` requires a decision about missing headers; see [Origin policy](./request-context.md#origin-policy) for the trade-offs. Browser deployment still needs explicit credential/cookie settings, CSRF review, CORS/preflight behavior where applicable, and tests through the actual host. Native clients and server-to-server callers need a deliberate authentication policy; allowing a missing Origin unconditionally would erase the demonstrated browser boundary.

The remaining lifecycle questions are user experience policy: after sign-out or session expiry, clear user-scoped atom data, unmount/reset the user runtime, and preserve or discard drafts according to the app's explicit policy. The middleware alone cannot ensure that previously cached data disappears from the UI.

BetterAuth storage failure is mapped distinctly. The Platform middleware test closes the provider's database and checks that requests fail with `AuthUnavailable`, not `Unauthorized`. Recovery after an outage is not yet covered. OAuth, session refresh cookies, cross-origin hosts, and native mobile cookie persistence also remain outside this test.
