# `@shivaedev/effect-trpc`

Effect-native query and mutation procedures for tRPC, with an optional Vitest
harness for calling routers as Effects.

This package currently targets exact early-access versions of Effect v4 and
tRPC. It is built for ShivaeDev applications and may change without a
deprecation period.

## Install

```sh
pnpm add @shivaedev/effect-trpc @trpc/server effect
```

## Adapter

Create one managed Effect runtime for the application, then bind tRPC procedure
builders to request-scoped Layers:

```ts
import { initTRPC } from "@trpc/server"
import { Layer, ManagedRuntime, Schema } from "effect"
import {
  makeEffectTRPC,
  makeRequestServices,
} from "@shivaedev/effect-trpc"

const runtime = ManagedRuntime.make(ApplicationLive)
const adapter = makeEffectTRPC({ runtime })

const t = initTRPC.context<RequestContext>().create()
const requestServices = makeRequestServices((context: RequestContext) =>
  Layer.succeed(Session, context.session),
)
const procedure = adapter.procedure(t.procedure, requestServices)
```

The generator receives decoded input and may yield anything supplied by the
application runtime or request Layer:

```ts
const router = t.router({
  movie: procedure
    .input(Schema.Struct({ id: Schema.String }))
    .query(function* ({ id }) {
      const movies = yield* Movies
      return yield* movies.find(id)
    }),
})
```

Effect Schema transformations are preserved across the tRPC boundary. Input
uses the schema's encoded type at the caller and decoded type in the generator;
output uses the schema's encoded type in the generator and decoded type at the
caller.

Build middleware, metadata, and other tRPC configuration on the ordinary tRPC
procedure builder before passing it to `adapter.procedure`. This release wraps
queries and mutations; subscriptions are not yet supported.

## Request services

`extendRequestServices` adds services to an existing request Layer while
retaining its context and requirements:

```ts
const adminServices = extendRequestServices(
  requestServices,
  (context: AdminRequestContext) => Layer.succeed(Admin, context.admin),
)
```

Layer construction failures use the same error handling as procedure failures.

## Errors and instrumentation

Explicit `TRPCError` failures pass through unchanged. The package also exports
Effect helpers such as `badRequest`, `unauthorized`, `forbidden`, `notFound`,
and `conflict`:

```ts
return yield* notFound("Movie not found")
```

Unmapped failures and defects become a redacted `INTERNAL_SERVER_ERROR`. Map
application errors deliberately when they should cross the API boundary:

```ts
const adapter = makeEffectTRPC({
  runtime,
  mapError: (error) =>
    error instanceof MovieMissing
      ? new TRPCError({ code: "NOT_FOUND", message: error.message })
      : undefined,
})
```

Each procedure runs in a span named after its tRPC path. `instrument` can add
application-specific Effect logging, metrics, or tracing without changing
procedure definitions.

## Vitest

Install `@effect/vitest` to use the optional testing entrypoint:

```sh
pnpm add --save-dev @effect/vitest vitest
```

Configure the router caller and test Layer once in the application's test
support:

```ts
import { makeTrpcIt } from "@shivaedev/effect-trpc/testing"

export const it = makeTrpcIt({
  adapter,
  createCaller: (context = defaultContext) => router.createCaller(context),
  layer: TestLive,
})
```

Tests receive an Effect-shaped caller. Calling the first argument creates a
caller with different context for that test:

```ts
it.effectTRPC("returns a movie", function* (trpc) {
  const movie = yield* trpc.movie({ id })
  expect(movie.id).toBe(id)
})

it.effectTRPC("supports another actor", function* (trpc) {
  const movie = yield* trpc({ session: otherSession }).movie({ id })
  expect(movie.id).toBe(id)
})
```

The test Layer is built once per worker. Its services override matching
application runtime services while all other runtime services remain available.
Use `around` to add application-wide test behavior such as a rollback wrapper.
`effectTRPC` supports `skip`, `skipIf`, `runIf`, `only`, `each`, and `fails`.
