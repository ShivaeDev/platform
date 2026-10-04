# `@shivaedev/effect-trpc`

Effect-native query, mutation, and subscription procedures for tRPC, with an optional Vitest
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
import { makeEffectTRPC } from "@shivaedev/effect-trpc/adapter.ts"
import { makeRequestServices } from "@shivaedev/effect-trpc/request-services.ts"

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

Subscriptions return an Effect Stream. The request Layer remains open for the
stream's lifetime, transport cancellation interrupts the stream, and scoped
finalizers run when it ends:

```ts
const updates = procedure.subscription(function* () {
  const movies = yield* Movies
  return movies.updates
})
```

`RequestSignal` exposes tRPC's transport signal when application code needs to
combine it with another disconnect signal. Build middleware, metadata, and
other tRPC configuration on the ordinary tRPC procedure builder before passing
it to `adapter.procedure`.

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

Each procedure runs in a span named after its tRPC path. `instrument` and
`instrumentStream` can add application-specific Effect logging, metrics, or
tracing without changing procedure definitions.

## Declared rejections

A declared rejection is a tagged Schema value the client may act on, such as a
field error. `rejectWith(schema)` sends failures that match `schema` to the
client as data; every other failure keeps the handling above.

Install the formatter once, then declare the rejections a procedure may send:

```ts
import { rejectionFormatter } from "@shivaedev/effect-trpc/rejection-formatter.ts"
import { rejectWith } from "@shivaedev/effect-trpc/rejection.ts"
import { BadRequest, Conflict } from "@shivaedev/platform/errors/taxonomy.ts"

const t = initTRPC.context<RequestContext>().create({
  errorFormatter: rejectionFormatter,
  transformer: superjson,
})

const rename = procedure
  .input(Schema.Struct({ name: Schema.String }))
  .mutation(function* ({ name }) {
    return yield* profiles.rename(name).pipe(rejectWith(Schema.Union([BadRequest, Conflict])))
  })
```

`rejectWith` encodes the matching failure with its schema and fails with a
`RejectionError`, a `TRPCError` that carries the encoded value. The formatter
adds it to the error data, next to tRPC's own fields:

```jsonc
{ "code": "CONFLICT", "httpStatus": 409, "path": "rename",
  "rejection": { "_tag": "Conflict", "message": "Name is taken", "field": "name" } }
```

- The error message is the rejection's `message` when it has one, otherwise
  its `_tag`. Only the encoded declared fields cross; the failure's `cause` and
  anything outside the schema never do.
- The code comes from the tag. tRPC derives the HTTP status from the code.
  Pass `rejectWith(schema, { code: (tag) => ... })` to choose another code;
  `rejectionCode(tag)` is the default mapping:

  | Tag | Code | HTTP |
  | --- | --- | --- |
  | `NotFound` | `NOT_FOUND` | 404 |
  | `Unauthorized` | `UNAUTHORIZED` | 401 |
  | `Forbidden` | `FORBIDDEN` | 403 |
  | `Conflict` | `CONFLICT` | 409 |
  | `PreconditionFailed` | `PRECONDITION_FAILED` | 412 |
  | `TooManyRequests` | `TOO_MANY_REQUESTS` | 429 |
  | `AuthUnavailable` | `SERVICE_UNAVAILABLE` | 503 |
  | any other, including `BadRequest` | `BAD_REQUEST` | 400 |
- When a procedure's input schema rejects the input, the formatter sends a
  `BadRequest` rejection with the first issue's message and, unless the issue
  concerns the whole input, its path as `field` (`"address.city"`,
  `"tags.1"`). The code is `BAD_REQUEST`, as for a `BadRequest` the procedure
  raises, so a form shows the error on its field before the handler runs. It
  also carries `invalidInput: true`, which a declared rejection never gets, so
  a client can show its own copy for input that did not parse and the
  declared message otherwise:

  ```jsonc
  { "code": "BAD_REQUEST", "httpStatus": 400, "path": "rename",
    "rejection": { "_tag": "BadRequest", "message": "Expected a value with a length of at least 1", "field": "name", "invalidInput": true } }
  ```

  `invalidInput` is reserved: `rejectWith` does not accept a schema that
  encodes a field by that name, and the formatter strips it from any declared
  rejection, so only input that did not parse carries it.
- An application with its own `errorFormatter` calls
  `withRejection(shape, error)` inside it.
- The error channel loses the declared types and gains `RejectionError`. An
  effect-contract operation's `error` schema works directly:
  `rejectWith(SaveOrder.error)`.

The browser-safe `@shivaedev/effect-trpc/client/rejection.ts` module reads the rejection from
a `TRPCClientError`:

```ts
import { decodeRejection, rejectionOf } from "@shivaedev/effect-trpc/client/rejection.ts"
import { rejectedField } from "@shivaedev/platform/errors/rejected-field.ts"

rejectionOf(error)                                          // Option<{ _tag: string, invalidInput?: true, ... }>, still encoded
decodeRejection(Schema.Union([BadRequest, Conflict]))(error) // Option<BadRequest | Conflict>
Option.flatMap(rejectionOf(error), rejectedField)           // Option<{ field, message }>
Option.exists(rejectionOf(error), (rejection) => rejection.invalidInput === true) // the input did not parse
```

Both return `Option.none()` for any error without a tagged rejection, and
`decodeRejection` also for a rejection its schema does not declare.
`rejectionOf` also returns `Option.none()` when `invalidInput` is present but
not `true`. An input failure still decodes as the declared `BadRequest`; the
mark is read from `rejectionOf`, or from `error.data.rejection.invalidInput` on a
`TRPCClientError` typed by the router. The modules under `client/` import only `effect`.

## Vitest

Install `@effect/vitest` to use the optional `testing/` modules:

```sh
pnpm add --save-dev @effect/vitest vitest
```

Configure the router caller and test Layer once in the application's test
support:

```ts
import { makeTrpcIt } from "@shivaedev/effect-trpc/testing/vitest.ts"

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
Tests install TestClock unless you pass `clock: "live"`.

`makeTrpcHarnessIt` builds an application-defined Effectful harness around the
caller when tests need additional services or fixtures. The harness is created
inside both the test Layer and the `around` wrapper, so setup participates in
the same scoped lifecycle as the test body.
