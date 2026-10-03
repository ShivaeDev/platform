# Errors and request context for native RPC

Applications built on tRPC tend to carry their own copies of the same error
classes, request id reference, optional identity service and request logging.
Platform provides these for native Effect RPC in three entry points:

| Entry | Runs in | Contents |
| --- | --- | --- |
| `@shivaedev/platform/errors` | browser and server | Schema error classes and `rejectedField` |
| `@shivaedev/platform/rpc` | browser and server | `RequestId`, `Identity`, `OptionalIdentity` and the middleware tags an `RpcGroup` declares |
| `@shivaedev/platform/rpc-server` | server | Middleware layers, Better Auth sessions, Origin policy and redaction |

The middleware tags live in a browser-safe entry because the shared `RpcGroup`
declaration names them, and the client imports that declaration. The server layers
live in a separate entry. The package test follows the import graph of the two
browser entries and fails if they import anything other than `effect`.

## Error taxonomy

`NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`,
`PreconditionFailed`, `TooManyRequests` and `AuthUnavailable` are
`Schema.TaggedError` classes. Each has a `message`. `BadRequest` and `Conflict`
also have an optional `field`. Use them directly as native RPC error schemas:

```ts
Rpc.make("Rename", {
  payload: { name: Schema.String },
  success: Profile,
  error: Schema.Union([NotFound, Conflict]),
})
```

They also work as effect-contract rejections: `rejections: { NotFound, Conflict }`.
The contract checks that each key matches the class's `_tag`, and these classes
meet that check.

`rejectedField(error)` returns `Option<{ field, message }>` for any tagged error
that has a string `field` and `message`. That covers `BadRequest`, `Conflict` and
effect-contract `fieldRejection` classes, whether decoded or still encoded. Pass
the result to an effect-form submitter:
`submitter.fail(rejected.field, rejected.message)`.

`rejectedField` is the canonical definition of a field rejection: a value with a
string `_tag`, a string `field` and a string `message`, as an instance or as
encoded JSON. Other fields are ignored. An untagged `{ field, message }`, a
non-string `field` and non-objects are not field rejections, so a defect or an
arbitrary thrown object with those keys is never shown as a field message. Code
that maps rejections to form fields should start from this check and then keep
only fields the form has. effect-react's default mapping does not yet require
`_tag`; aligning it is tracked separately.

The set has changed from what the consumers use today:

- `ConflictError` is now `Conflict`, to match the other tags. The tag is sent over
  the wire, so an application moving to these classes changes it in the same
  release on client and server.
- `InternalError` is gone. Unexpected failures stay defects. Native RPC sends them
  as defects, and the middleware logs them. They are not declared errors carrying
  a server-written message.
- `AuthUnavailable` is new. It separates a provider outage from a signed-out user.

The message is for diagnostics and a fallback display. Applications can still
choose their own wording per tag.

On tRPC, `rejectWith` from `@shivaedev/effect-trpc` sends these classes as
declared rejections. `NotFound`, `Unauthorized`, `Forbidden`, `Conflict`,
`PreconditionFailed` and `TooManyRequests` get the tRPC codes `NOT_FOUND`,
`UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `PRECONDITION_FAILED` and
`TOO_MANY_REQUESTS`, and `AuthUnavailable`, a provider outage, gets
`SERVICE_UNAVAILABLE`. Every other tag, including `BadRequest`, gets
`BAD_REQUEST`. An input that fails the procedure's input schema arrives as a
`BadRequest` with the failing path as its `field` and `invalidInput: true`,
which tells it apart from a `BadRequest` the procedure declares. The client
reads the field with `Option.flatMap(rejectionOf(error), rejectedField)`; see
the effect-trpc README.

## Request id, identity and logging

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

The middleware added last runs outermost. Add `RequestTracing` last so it also
annotates logs written by the auth middleware.

- `RequestTracing` gives handlers a `RequestId`. It takes the id from the
  `x-request-id` header (the `header` option changes the name) when the value is
  1–128 characters from `[A-Za-z0-9._:-]`. Otherwise it generates a 32-character
  hex id from Effect's `Random`. The id is for correlation only; a caller can
  choose it. It sets `request.id` and `rpc.method` on the `RpcServer.<method>`
  span and on every log written inside the request. A declared failure logs one
  `RPC failure` line at Info with `rpc.failure` set to the error's tag. A defect
  logs `RPC defect` at Error with `rpc.defect`, a list with each defect in
  redacted form. The raw `Cause` is not logged, because a defect often holds
  values taken from the payload. Interruptions are not logged, and a successful
  request writes no log line. Both failure lines include the payload in redacted
  form.
- Redaction replaces `Redacted` values, and fields whose names match
  `isSensitiveKey`, with `<redacted>`. `isSensitiveKey` lowercases the name and
  drops `-` and `_`, then matches names containing password, passphrase, secret,
  token, authorization, cookie, apikey, accesskey, credential, privatekey, jwt,
  bearer, signature, sessionid, cardnumber, accountnumber, csrf or xsrf, and the
  exact names session and pan. It also splits the name into words at camelCase
  boundaries, `-` and `_`, and matches any word that is otp, pin, cvv, cvc, ssn or
  iban, so `otpCode`, `userPin` and `payoutIban` are redacted while `pinned`,
  `options` and `spinner` are not. It walks nested objects and arrays to depth 8
  and keeps the first 50 items or keys of each, followed by a marker counting the
  rest. Typed arrays and `ArrayBuffer`s become a summary such as
  `<Uint8Array 4096 bytes>`. An `Error` keeps its `name`, `message` and `stack`,
  and its own fields and `cause` are redacted like any object. Supply
  `sensitive: (key) => isSensitiveKey(key) || key === "email"` to extend the
  key list. Headers are never logged.
- Every string, including error messages and stacks, is masked before it is kept:
  the credential after `Bearer` or `Basic`, JWT-shaped tokens (`eyJ…` with three
  dot-separated parts), the password in a URL such as `postgres://user:pass@host`,
  and the value in `key=value` or `key: value` text when the key is sensitive
  under the active policy. The string is then cut to 2048 characters with a
  `…<N more chars>` marker. These patterns catch common shapes only; a secret
  interpolated into a message in any other form is kept, so messages still must
  not carry secrets.
- `RequestTracing` also replaces each defect in the request's `Cause` with its
  redacted form before the cause leaves the middleware. RpcServer builds three
  things from that cause: the defect sent to the client, the exit recorded on
  the `RpcServer.<method>` span, and the cause it hands to every installed
  `ErrorReporter`. All three therefore see the redacted defect. An `Error`
  defect stays an `Error` with the same `name`, a masked `message` and `stack`,
  redacted own fields and `cause`, and the `ErrorReporter` ignore, severity and
  attributes hints (attributes redacted), so the client decodes it as before and
  reporters group it as before. Declared failures and interruptions pass through
  unchanged: the client needs the declared error intact, and it is already sent
  to the caller. This covers defects raised by the handler and by middleware
  added before `RequestTracing`; a defect raised by middleware added after it,
  or by an RPC without `RequestTracing`, reaches the client, the span and the
  reporters unredacted. For causes reported outside RPC, wrap the reporter:
  `ErrorReporter.layer([redactingErrorReporter(sentryReporter)])` hands it
  `redactCause(cause)`. `redactCause` and `redactDefect` are exported for other
  sinks.
- `Authenticated` gives handlers `Identity` (`{ id }`) and fails with
  `Unauthorized`, `AuthUnavailable` or `Forbidden`. `MaybeAuthenticated` gives
  handlers `OptionalIdentity` instead: a missing or invalid session becomes
  `Option.none()`. A provider failure is `AuthUnavailable` in both cases, never
  treated as anonymous. Both set `user.id` on the span and `userId` on logs.
- `betterAuthSessions` calls Better Auth once per RPC invocation. A thrown error
  or rejected promise is logged at Error in redacted form, and the client receives
  only `AuthUnavailable` with a generic message.
- Some applications need more than an id, such as a role or the full user.
  `resolveSession(policy, headers, rpc)` runs the same Origin check and provider
  lookup and returns the session. Use it inside an application-owned
  `RpcMiddleware` that provides the application's own service.

## Transport headers and message headers

The `headers` that native RpcServer passes to middleware are not the HTTP request
headers. For HTTP and WebSocket transports, RpcServer appends the headers carried
inside each RPC message to the transport headers, and the message values win.
A browser page on any site can send a `text/plain` POST, which needs no CORS
preflight, whose body sets `origin`, `cookie` or `authorization` in a message
while the browser attaches the victim's cookie to the request itself. Any
security decision made from those merged headers can be forged.

`resolveSession`, and therefore `authenticatedLayer` and
`maybeAuthenticatedLayer`, ignore message headers. They read the
`HttpServerRequest` that RpcServer runs each request with: the POST for HTTP and
the upgrade request for WebSocket. Both the Origin policy (its `origin` and
`headers`) and the session provider see only those headers. A cookie or
`authorization` value inside a message is never used, and neither is an Origin.
When there is no `HttpServerRequest`, as with `RpcTest`, workers or a raw socket
server, the RPC headers are used, because there are no transport headers to
prefer and no browser attaches ambient credentials.

An application-owned middleware that reads any header for a security decision
should call `transportHeaders(headers)` from `@shivaedev/platform/rpc-server`
instead of using `headers` directly. The request id is still read from the RPC
headers, so a client can set it per call; it is for correlation only.

## Origin policy

A policy is a function of `{ origin: Option<string>, rpc, headers }`. Platform
does not pick one. `trustedOrigins({ allow, missing })` matches origins exactly
and requires you to decide what happens when the header is missing. The literal
`Origin: null` is a present value; it only passes if you list it.

The Origin check is CSRF protection for cookie sessions. Browsers send `Origin`
on the POST requests native RPC uses over HTTP. The choices:

- `missing: "reject"` works for browser-only applications. It rejects
  server-to-server callers and native HTTP stacks that omit the header.
- Capacitor WebViews send their own origin (`capacitor://localhost` on iOS,
  `https://localhost` on Android by default). List it rather than allowing a
  missing header. Requests made through a native HTTP plugin may have no `Origin`
  at all.
- `missing: "allow"` accepts those clients. It also accepts any other request
  without an Origin header, including requests from software that strips it.
  Accept it only with another control in place: SameSite cookies, a custom header
  that a browser cannot send cross-site without a preflight, or bearer tokens
  instead of cookies.
- A custom policy can make a narrower choice. For example, it can allow a missing
  Origin only for particular RPCs, or only when a header the client sets is
  present.

The Origin check runs before the provider lookup. A rejected request fails with
`Forbidden` whether or not it carries a session. The check reads the transport
`Origin` header, never one set inside an RPC message; see
[transport headers](#transport-headers-and-message-headers). A policy that
relies on a custom header as a CSRF control therefore also sees only headers the
browser sent on the request, which a cross-site page cannot set without a
preflight.

## Evidence

- [rpc-session.test.ts](../../packages/platform/test/rpc-session.test.ts) signs up
  users through real Better Auth with an ephemeral SQLite database and calls
  through the native HTTP client, JSON serialization and a Web handler. It checks
  that twelve concurrent requests alternating between two users each receive
  their own identity, with their own request id in log annotations and spans. It
  checks cross-user `Forbidden`, anonymous and signed-in `MaybeAuthenticated`
  results, and that missing and tampered cookies fail with `Unauthorized`. After
  the database is closed, requests fail with `AuthUnavailable` and a logged
  provider error. It covers these Origin cases: an exact match, `capacitor://`,
  an attacker origin, `null`, a missing header under both `missing` settings, and
  a custom per-RPC policy. It also checks that rejected origins never reach the
  provider.
- [rpc-transport-headers.test.ts](../../packages/platform/test/rpc-transport-headers.test.ts)
  posts raw `text/plain` bodies to the Web handler. A trusted `origin` set in the
  message header list, with an attacker or missing transport Origin and the
  victim's cookie, fails with `Forbidden`. A cookie or `authorization` set only
  in the message fails with `Unauthorized`.
- [rpc-websocket-headers.test.ts](../../packages/platform/test/rpc-websocket-headers.test.ts)
  runs the RpcServer WebSocket protocol over an in-memory socket and checks the
  same Origin and cookie cases against the upgrade request.
- [rpc-tracing.test.ts](../../packages/platform/test/rpc-tracing.test.ts) uses
  `RpcTest`. It checks that the request id reaches the handler, the logs and the
  server span, that missing, malformed and oversized ids are replaced, that
  failure and defect logs redact nested, array and `Redacted` payload fields, and
  that a custom sensitive-key policy applies.
- [rpc-redaction.test.ts](../../packages/platform/test/rpc-redaction.test.ts)
  checks the extended key list, word matching and its near misses, the caps on
  arrays, objects and strings, masking of tokens, URL passwords and sensitive
  assignments inside text, binary summaries, that the defect seen by the client,
  an installed `ErrorReporter` and the server span is redacted, that
  `redactingErrorReporter` keeps severity and attributes, that defect logs redact an error's own fields and its `cause`, and
  that provider failures do not log credential fields.
- [errors.test.ts](../../packages/platform/test/errors.test.ts) sends taxonomy
  errors through HTTP JSON and checks that they decode to class instances, keep
  their field, and are recognized by `rejectedField`.
- [trpc-rejections.test.ts](../../packages/platform/test/trpc-rejections.test.ts)
  sends taxonomy errors and an invalid input through tRPC over HTTP with
  superjson and checks their codes and statuses, that they decode to class
  instances, and that `rejectedField` reads the field from the encoded
  rejection.
- [rpc.typecheck.test.ts](../../packages/platform/test/rpc.typecheck.test.ts) checks at compile
  time that `Identity` is only available behind `Authenticated`, that client
  error types include the middleware errors, and that `trustedOrigins` requires
  a `missing` decision.

## Limits

- The request id is not written to response headers. RPC middleware cannot set
  them. Clients correlate through their own trace span, which the RPC protocol
  propagates.
- Session refresh cookies from Better Auth (`updateAge`) are not written back
  through RPC responses. Refresh sessions through the auth HTTP handler.
- Declared failures log at Info. Alerting on particular tags is the
  application's decision.
- Export of spans and logs, and the Antumbra sink's failure behavior, remain
  roadmap §14 work.
