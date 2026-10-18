# Errors and request context for native RPC

Applications built on tRPC tend to carry their own copies of the same error classes, request id reference, optional identity service and request logging. Platform provides these for native Effect RPC. The [Platform README](../../packages/platform/README.md) teaches the API; this guide explains the decisions behind it.

## Where the modules run

`@shivaedev/platform/errors/*.ts` and `@shivaedev/platform/rpc/*.ts` run in the browser and on the server: Schema error classes, `rejectedField`, `RequestId`, `Identity`, `OptionalIdentity` and the middleware tags an `RpcGroup` declares. The middleware tags live there because the shared `RpcGroup` declaration names them and the client imports that declaration. `@shivaedev/platform/server/rpc-server/**/*.ts` holds the server Layers: session middleware, Better Auth sessions, Origin policy and redaction. A package test fails if a browser-safe module imports anything other than `effect`.

## Errors

`NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed`, `TooManyRequests` and `AuthUnavailable` are `Schema.TaggedError` classes. Use them directly as native RPC error schemas or as effect-contract rejections. `AuthUnavailable` tells a provider outage apart from a signed-out user. The message is for diagnostics and a fallback display; applications choose their own wording per tag.

`rejectedField` is the canonical definition of a field rejection: a value with a string `_tag`, a string `field` and a string `message`, as an instance or as encoded JSON. An untagged `{ field, message }` is not one, so a defect or an arbitrary thrown object with those keys is never shown as a field message. Code that maps rejections to form fields starts from this check and keeps only fields the form has.

Unexpected failures stay defects rather than declared errors carrying a server-written message. Native RPC sends them as defects, and request tracing redacts and logs them. On tRPC, `rejectWith` from `@shivaedev/effect-trpc` sends the same classes as declared rejections; see the [effect-trpc README](../../packages/effect-trpc/README.md).

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
- Capacitor WebViews send their own origin (`capacitor://localhost` on iOS, `https://localhost` on Android by default). List it rather than allowing a missing header. Requests made through a native HTTP plugin may have no `Origin` at all.
- `missing: "allow"` accepts those clients. It also accepts any other request without an Origin header, including requests from software that strips it. Accept it only with another control in place: SameSite cookies, a custom header that a browser cannot send cross-site without a preflight, or bearer tokens instead of cookies.
- A custom policy can make a narrower choice, for example allowing a missing Origin only for particular RPCs, or only when a header the client sets is present.

The Origin check runs before the provider lookup. A rejected request fails with `Forbidden` whether or not it carries a session.

## Limits

- The request id is not written to response headers; RPC middleware cannot set them. Clients correlate through their own trace span, which the RPC protocol propagates.
- Session refresh cookies from Better Auth (`updateAge`) are not written back through RPC responses. Refresh sessions through the auth HTTP handler.
- Declared failures log at Info. Alerting on particular tags is the application's decision.
