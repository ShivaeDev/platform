# @shivaedev/platform

Opinionated shared setup for ShivaeDev Effect applications. This package favors
one consistent application shape over supporting every possible combination of
database, transport, and test framework.

Generic Prisma and tRPC integrations remain available separately from
`@shivaedev/effect-prisma` and `@shivaedev/effect-trpc`.

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
