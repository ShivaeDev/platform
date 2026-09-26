# @shivaedev/platform

Opinionated shared setup for ShivaeDev Effect applications. This package favors
one consistent application shape over supporting every possible combination of
database, transport, and test framework.

Generic Prisma and tRPC integrations remain available separately from
`@shivaedev/effect-prisma` and `@shivaedev/effect-trpc`.

`effect` is the only required peer. The `runtime`, `node-http`, `errors`, `rpc`
and `rpc-server` entries need nothing else. Install the optional peers for the
entries that use them:

- `better-auth`: `better-auth` and `@shivaedev/effect-prisma`
- `testing`: `@shivaedev/effect-prisma`, `@shivaedev/effect-trpc`,
  `@trpc/server`, and `@effect/vitest`

## Runtime

Build one managed runtime for the application and share it with integrations:

```ts
import { makePlatformRuntime } from "@shivaedev/platform/runtime"

export const runtime = makePlatformRuntime(ApplicationLive, {
  developmentCacheKey: "application",
})
```

The optional cache key keeps one runtime across development module reloads.
The runtime also carries transaction- and request-scoped service overrides
across promise boundaries.

## Node HTTP

Long-lived responses under Bun's `node:http` compatibility layer may not abort
their Web request signal when the underlying socket disappears. Combine the
available Web, procedure, request, and socket signals at the subscription
boundary:

```ts
import { nodeSubscriptionSignal } from "@shivaedev/platform/node-http"

const subscription = nodeSubscriptionSignal({
  request,
  nodeRequest,
  signals: [procedureSignal],
})

try {
  await consume(subscription.signal)
} finally {
  subscription.dispose()
}
```

The node request may be supplied directly or carried by an srvx Web request.
Applications still own subscription limits, event buses, and transport policy.

## Better Auth

`effectPrismaAdapter` stores Better Auth data through the application's Effect
Prisma database and runtime, including Better Auth transactions:

```ts
import { effectPrismaAdapter } from "@shivaedev/platform/better-auth"
import { betterAuth } from "better-auth"

const auth = betterAuth({
  database: effectPrismaAdapter(Database, runtime),
})
```

The adapter owns database translation only. Providers, plugins, cookies,
session policy, and authorization remain application configuration. Native
experimental Better Auth joins are not supported; the standard adapter join
fallback remains available.

## Errors and native RPC request context

`@shivaedev/platform/errors` exports browser-safe `Schema.TaggedError` classes:
`NotFound`, `Unauthorized`, `Forbidden`, `BadRequest` and `Conflict` (both with an
optional `field`), `PreconditionFailed`, `TooManyRequests` and `AuthUnavailable`.
Use them as native RPC error schemas or effect-contract rejections.
`rejectedField(error)` extracts `{ field, message }` from any field rejection so a
form can show it.

`@shivaedev/platform/rpc` declares the `RequestTracing`, `Authenticated` and
`MaybeAuthenticated` middleware and the `RequestId`, `Identity` and
`OptionalIdentity` services they provide. It is browser-safe, so shared `RpcGroup`
declarations can use it. Implement the middleware on the server with
`@shivaedev/platform/rpc-server`:

```ts
import { Authenticated, RequestTracing } from "@shivaedev/platform/rpc"
import { authenticatedLayer, betterAuthSessions, requestTracingLayer, trustedOrigins } from "@shivaedev/platform/rpc-server"

const Api = RpcGroup.make(/* ... */).middleware(Authenticated).middleware(RequestTracing)

const Middleware = Layer.mergeAll(
  requestTracingLayer(),
  authenticatedLayer({
    provider: betterAuthSessions((headers) => auth.api.getSession({ headers })),
    origin: trustedOrigins({ allow: ["https://app.example"], missing: "reject" }),
  }),
)
```

Each RPC gets its own request id and resolves its own session. The Origin check
and session lookup read the HTTP request's own headers, never header pairs a
client puts inside an RPC message. An outage of the
session provider fails with `AuthUnavailable`, never as a signed-out user.
Failures log once with a redacted payload. The Origin policy is a function the
application supplies; see the
[request context guide](../../docs/framework/request-context.md) for the
trade-offs between browsers and native clients.

## Testing

Configure the application database, tRPC caller, and test Layer once:

```ts
import { makePlatformIt } from "@shivaedev/platform/testing"

export const it = makePlatformIt(Database)({
  adapter: effectTrpc,
  createCaller: (options = defaultActor) => appRouter.createCaller(options),
  layer: TestLive,
  extend: ({ db, trpc }) =>
    Effect.succeed({
      actors,
      factories: makeFactories(db),
      fixtures: makeFixtures({ db, trpc }),
    }),
})
```

Every `effectApp` test runs inside a real transaction. tRPC procedures, direct
database calls, factories, and fixtures share that transaction, which is rolled
back after both successful and failed tests:

```ts
it.effectApp("creates a movie", function* ({ trpc, db, factories, promise }) {
  const input = factories.movie()
  const movie = yield* trpc.movie.create(input)
  const stored = yield* db.Movie.where({ id: movie.id }).first()

  expect(stored?.title).toBe(input.title)
})
```

`promise(() => ...)` runs a promise-based application boundary, such as Better
Auth or an HTTP handler, with the same transaction-scoped Effect services.

Calling `trpc(options)` creates a caller for another application actor without
rebuilding the worker-scoped test Layer. `effectApp` also supports `skip`,
`skipIf`, `runIf`, `only`, `each`, and `fails`.
