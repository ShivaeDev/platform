# Errors and request context for native RPC

Applications tend to carry their own copies of the same error classes, request id reference, optional identity service and request logging. Effect Contract provides the shared errors; Platform provides request context for native Effect RPC. The [Platform README](../../packages/platform/README.md) teaches the API; this guide explains the decisions behind it.

## Where the modules run

`@shivaedev/errors/*.ts` and `@shivaedev/platform/rpc/*.ts` run in the browser and on the server: Schema error classes, `rejectedField`, the redaction policy, `RequestId`, `Identity`, `OptionalIdentity` and the middleware tags an `RpcGroup` declares. The middleware tags live there because the shared `RpcGroup` declaration names them and the client imports that declaration. `@shivaedev/platform/server/rpc-server/**/*.ts` holds the server Layers: session middleware, Better Auth sessions, Origin policy and the redacting tracer. Quality's `errors-stay-browser-safe`, `contract-never-imports-server` and `platform-client-stays-browser-safe` import fences keep the shared modules browser-safe.

## Errors

`NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed`, `TooManyRequests` and `AuthUnavailable` are `Schema.TaggedError` classes. Use them directly as native RPC error schemas or as contract rejections. `AuthUnavailable` tells a provider outage apart from a signed-out user. The message is for diagnostics and a fallback display; applications choose their own wording per tag.

`rejectedField` is the canonical definition of a field rejection: a value with a string `_tag`, a string `field` and a string `message`, as an instance or as encoded JSON. An untagged `{ field, message }` is not one, so a defect or an arbitrary thrown object with those keys is never shown as a field message. Code that maps rejections to form fields starts from this check and keeps only fields the form has.

Unexpected failures stay defects rather than declared errors carrying a server-written message. Native RPC sends them as defects, and request tracing redacts and logs them.

## Request id, identity and logging

`appHost` adds `RequestTracing` outermost on a server-side copy of every served group, so shared contracts do not declare it. When you build a native RPC server directly, declare `RequestTracing` yourself and add it last: the middleware added last runs outermost, so tracing also annotates logs written by the auth middleware and redacts defects raised there.

```ts
const Account = RpcGroup.make(/* ... */)
  .middleware(Authenticated)
  .middleware(RequestTracing)

const policy = {
  provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
  origin: trustedOrigins({ allow: [appOrigin, "capacitor://localhost"], missing: "reject" }),
}
const Middleware = Layer.mergeAll(authenticatedLayer(policy), requestTracingLayer())
```

The request id is for correlation only; a caller can choose it. Tracing logs declared failures at Info and defects at Error, with the payload in redacted form, and never logs headers or the raw `Cause`. It also replaces each defect in the request's `Cause` with its redacted form, so the client, the server span and every `ErrorReporter` see the same redacted defect. Defects raised outside the tracing boundary, including RPCs that omit tracing on a hand-built server, stay unredacted; for causes reported outside RPC, wrap the reporter with `redactingErrorReporter`.

Redaction masks common credential shapes in strings (Bearer and Basic credentials, JWTs, URL passwords, sensitive `key=value` text). A secret interpolated into a message in any other form is kept, so messages still must not carry secrets.

`Authenticated` gives handlers `Identity` and fails with `Unauthorized`, `AuthUnavailable` or `Forbidden`. `MaybeAuthenticated` gives `OptionalIdentity`; a provider failure is `AuthUnavailable` in both, never treated as anonymous. An application that needs more than an id, such as a role, calls `resolveSession(policy, headers, rpc)` inside its own `RpcMiddleware`, which runs the same Origin check and provider lookup.

## Transport headers and message headers

The `headers` that native RpcServer passes to middleware are not the HTTP request headers. For HTTP and WebSocket transports, RpcServer appends the headers carried inside each RPC message to the transport headers, and the message values win. A browser page on any site can send a `text/plain` POST, which needs no CORS preflight, whose body sets `origin`, `cookie` or `authorization` in a message while the browser attaches the victim's cookie to the request itself. Any security decision made from those merged headers can be forged.

`resolveSession`, and therefore `authenticatedLayer` and `maybeAuthenticatedLayer`, ignore message headers. They read the `HttpServerRequest` that RpcServer runs each request with: the POST for HTTP and the upgrade request for WebSocket. Both the Origin policy and the session provider see only those headers. When there is no `HttpServerRequest`, as with `RpcTest`, workers or a raw socket server, the RPC headers are used, because there are no transport headers to prefer and no browser attaches ambient credentials.

An application-owned middleware that reads any header for a security decision calls `transportHeaders(headers)` from `@shivaedev/platform/server/rpc-server/transportHeaders.ts` instead of using `headers` directly. The request id is still read from the RPC headers, so a client can set it per call.

## Origin policy

A policy is a function of `{ origin: Option<string>, rpc, headers }`. Platform does not pick one. `trustedOrigins({ allow, missing })` matches origins exactly and requires you to decide what happens when the header is missing. The literal `Origin: null` is a present value; it only passes if you list it.

The Origin check is CSRF protection for cookie sessions. Browsers send `Origin` on the POST requests native RPC uses over HTTP. The choices:

- `missing: "reject"` works for browser-only applications. It rejects server-to-server callers and native HTTP stacks that omit the header.
- Capacitor WebViews send their own origin (`capacitor://localhost` on iOS, `https://localhost` on Android by default). List it in the session policy and opt in to transport access with `appHost({ nativeOrigins, ... })`; the session policy alone cannot admit a request through the earlier transport guard. Use the WebView's own fetch so NDJSON updates arrive incrementally and abort releases server work.
- `missing: "allow"` accepts those clients. It also accepts any other request without an Origin header, including requests from software that strips it. Accept it only with another control in place: SameSite cookies, a custom header that a browser cannot send cross-site without a preflight, or bearer tokens instead of cookies.
- A custom policy can make a narrower choice, for example allowing a missing Origin only for particular RPCs, or only when a header the client sets is present.

The Origin check runs before the provider lookup. A rejected request fails with `Forbidden` whether or not it carries a session.

## Bundled native bearer sessions

A Capacitor or similar WebView loads its page from the app bundle, so same-site host cookies cannot be its session transport. Opt in at `betterAuthMount(options, { bearerSessions: { origins: ["capacitor://localhost", "https://localhost"] } })`, and include those bundle origins in Better Auth's `trustedOrigins`. This host option installs Better Auth's `bearer({ requireSignature: true })` plugin; the default mount remains cookie-only. Use `betterAuthSessions(mounted.admittedSessions((headers) => mounted.auth.api.getSession({ headers })))` as the host's session provider, including when no sign-in policy is configured.

The native client signs in through the existing auth routes using `credentials: "omit"`, reads its signed credential from `set-auth-token`, and sends `Authorization: Bearer <signed credential>` on subsequent auth and RPC requests, still omitting cookies. Store the credential in OS-backed secure storage, never web storage (localStorage, sessionStorage or IndexedDB). Browser responses retain HttpOnly cookies and omit both the token header and JSON token fields. Only listed bundled Origins can receive the signed credential header; do not list browser origins in `bearerSessions.origins`.

For same-origin browser requests and callers without an Origin, the session cookie wins whenever it is present. A bearer header cannot upgrade that cookie's account, substitute for a revoked cookie or combine accounts. Without a session cookie, Better Auth verifies the bearer signature and stored session. Platform resolves the same `Identity`, profile and role context, and maps missing, invalid, unsigned, expired and revoked bearer sessions to the existing `Unauthorized` failure. Provider outages remain `AuthUnavailable`; credential-shaped logs and exported traces are redacted.

Sign-out revokes the bearer session. A successful native sign-in that carries the previous bearer revokes that previous session as well. Existing streams revalidate their original headers every `streamRevalidationInterval` (30 seconds by default), ending with `Unauthorized` after revocation instead of adopting a replacement identity. Keep Better Auth's cookie cache disabled for database-backed revocation.

Pass the same exact bundle origins to the host:

```ts
const nativeOrigins = ["capacitor://localhost", "https://localhost"];
const host = appHost({ group, handlers, routes: mounted.routes, sessions, nativeOrigins });
```

`nativeOrigins` admits only those exact origins on RPC and `/api/auth/*` routes; wildcards, patterns and non-origin URLs are rejected at startup. The host answers their preflights and echoes the origin with `Vary: Origin`, allows `Authorization` and `Content-Type`, and exposes `set-auth-token` on auth responses. RPC allows POST; auth allows GET and POST. It never sends `Access-Control-Allow-Credentials`. Every admitted native request loses its cookies before session resolution: only its signed bearer session can authenticate it. This prevents an allowed origin from opening a cookie CSRF path. A cookie-only native request is anonymous and protected RPCs reject it. App authorization stays application-owned.

Omitting `nativeOrigins` retains the existing transport policy. The option retains trusted-proxy peer and forwarded-authority checks, NDJSON content-type enforcement, bounded bodies, transport-only identity, redaction and session authorization. Native HTTP calls without an Origin can use the existing guard with an explicitly permissive session origin policy. The [Platform README](../../packages/platform/README.md#bundled-native-clients) shows the complete host composition.

## Limits

- The request id is not written to response headers; RPC middleware cannot set them. Clients correlate through their own trace span, which the RPC protocol propagates.
- Session refresh cookies from Better Auth (`updateAge`) are not written back through RPC responses. Refresh sessions through the auth HTTP handler.
- Declared failures log at Info. Alerting on particular tags is the application's decision.
