# @shivaedev/platform

Opinionated shared setup for ShivaeDev Effect applications. This package favors
one consistent application shape over supporting every possible combination of
database, transport, and test framework.

The first public surface is the combined integration test harness. Generic
Prisma and tRPC integrations remain available separately from
`@shivaedev/effect-prisma` and `@shivaedev/effect-trpc`.

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
it.effectApp("creates a movie", function* ({ trpc, db, factories }) {
  const input = factories.movie()
  const movie = yield* trpc.movie.create(input)
  const stored = yield* db.Movie.where({ id: movie.id }).first()

  expect(stored?.title).toBe(input.title)
})
```

Calling `trpc(options)` creates a caller for another application actor without
rebuilding the worker-scoped test Layer. `effectApp` also supports `skip`,
`skipIf`, `runIf`, `only`, `each`, and `fails`.
