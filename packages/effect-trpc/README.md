# @shivaedev/effect-trpc

Use Effect services, Schemas and Streams inside a tRPC API. Procedures share the application's runtime, get request services from tRPC context, and declare the failures a client may act on without exposing other failures.

## Why you want this

A tRPC handler is a Promise boundary; your application is made of Effects with services, typed failures and scoped resources. Rebuilding those services in each handler makes the boundary harder to reason about. Bind a procedure once, then write the feature as a generator:

```ts
const order = procedure
  .input(Schema.Struct({ id: Schema.String }))
  .query(function* ({ id }) {
    const orders = yield* Orders;
    return yield* orders.find(id);
  });
```

The caller sends the input; the generator yields application services and returns its result. The same builder handles mutations and subscriptions, and a test can yield a real router call as an Effect. This package is for applications that use tRPC; Platform's native query and command path is `@shivaedev/effect-contract`.

## Using it

### How to think about it

tRPC owns the router, middleware, request context and transport. Effect owns the work inside the procedure: services, typed failures, Streams and scoped resources. The adapter joins those two boundaries.

There are two service lifetimes. The **application runtime** supplies services shared by procedures. A **request Layer** derives services from the context tRPC passes after middleware. A resolver is a generator that receives decoded input and yields services from either source. The compiler rejects a resolver or Stream that requires a service neither source supplies.

There are also two error decisions. A **declared rejection** is a Schema-described failure you explicitly choose to send as client data. A `TRPCError` expresses an explicit transport error. Other failures and defects become an `INTERNAL_SERVER_ERROR` with the message `Internal server error`, unless an application error mapper chooses a public error.

### 1. Once per application: runtime and request services

Create the runtime, tRPC instance and procedure builder together. This complete example uses an application service for order lookup and a request service for the request identifier:

```ts
import { initTRPC } from "@trpc/server";
import { Context, Effect, Layer, ManagedRuntime, Schema } from "effect";
import { makeEffectTRPC } from "@shivaedev/effect-trpc/adapter.ts";
import { makeRequestServices } from "@shivaedev/effect-trpc/request-services.ts";

const Order = Schema.Struct({ id: Schema.String, name: Schema.String });

class Orders extends Context.Service<Orders, {
  readonly find: (id: string) => Effect.Effect<typeof Order.Type>;
}>()("example/Orders") {}

class RequestId extends Context.Service<RequestId, string>()("example/RequestId") {}

interface RequestContext {
  readonly requestId: string;
}

const ApplicationLive = Layer.succeed(Orders, {
  find: (id) => Effect.succeed({ id, name: "Desk lamps" }),
});
const runtime = ManagedRuntime.make(ApplicationLive);
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.context<RequestContext>().create();
const requestServices = makeRequestServices((context: RequestContext) =>
  Layer.succeed(RequestId, context.requestId),
);
const procedure = adapter.procedure(t.procedure, requestServices);

export const router = t.router({
  order: procedure.input(Schema.Struct({ id: Schema.String })).query(function* ({ id }) {
    const orders = yield* Orders;
    return { order: yield* orders.find(id), requestId: yield* RequestId };
  }),
});

const result = await router.createCaller({ requestId: "request-1" }).order({ id: "order-1" });
```

`result` is `{ order: { id: "order-1", name: "Desk lamps" }, requestId: "request-1" }`. The runtime supplies `Orders`; the context supplies `RequestId`. Replace the example lookup Layer with the application's implementation.

Build tRPC middleware before calling `adapter.procedure`. A middleware-added context value can become a service:

```ts
class Actor extends Context.Service<Actor, string>()("example/Actor") {}

const authenticated = t.procedure.use(({ ctx, next }) =>
  next({ ctx: { ...ctx, actor: `actor:${ctx.requestId}` } }),
);
const actorServices = makeRequestServices((context: RequestContext & { readonly actor: string }) =>
  Layer.succeed(Actor, context.actor),
);
const authenticatedProcedure = adapter.procedure(authenticated, actorServices);
```

The example middleware derives a value to show the context boundary. Authentication and authorization policy belong to the application.

Use `extendRequestServices(base, additional)` when another procedure needs services derived from the base request Layer:

```ts
import { extendRequestServices } from "@shivaedev/effect-trpc/request-services.ts";

class RequestLabel extends Context.Service<RequestLabel, string>()("example/RequestLabel") {}

const labeledServices = extendRequestServices(requestServices, () =>
  Layer.effect(RequestLabel, Effect.map(RequestId, (id) => `request:${id}`)),
);
const labeledProcedure = adapter.procedure(t.procedure, labeledServices);
```

The additional Layer can yield a service supplied by the base Layer. Typed request-Layer failures go through the adapter's error mapper, just like resolver failures; a synchronous Layer-construction defect is redacted.

### 2. Once per feature: input, result and procedure kind

`input(schema)` decodes the caller's encoded value into the generator's input. `output(schema)` also decodes: the generator returns the schema's encoded value, and the caller receives its decoded value.

```ts
const increment = procedure
  .input(Schema.Struct({ value: Schema.NumberFromString }))
  .output(Schema.NumberFromString)
  .query(function* ({ value }) {
    yield* Effect.void;
    return String(value + 1);
  });
```

For input `{ value: "4" }`, the generator sees `value` as the number `4` and returns the string `"5"`; the caller receives the number `5`. The input and result types follow these transformations.

A mutation uses the same generator and service model:

```ts
const uppercase = procedure.input(Schema.String).mutation(function* (name) {
  yield* Effect.void;
  return name.toUpperCase();
});
```

Calling this mutation with `"changed"` returns `"CHANGED"`. Choosing `mutation` makes it a tRPC mutation; transaction policy stays in the application.

A subscription generator returns an Effect Stream:

```ts
import { Stream } from "effect";

const updates = procedure.subscription(function* () {
  const requestId = yield* RequestId;
  return Stream.make(`${requestId}:one`, `${requestId}:two`);
});
```

tRPC observes an `AsyncIterable`. The subscription resolver can yield request services. The Stream's scoped finalizers run when it ends, and aborting the tRPC caller's transport signal ends pending stream iteration and runs its finalizers. `output(schema)` decodes each emitted value.

### 3. Once per feature: declare client rejections

Use a tagged Schema for a failure the client may understand. Configure the formatter on the tRPC instance, then apply `rejectWith` to the Effect that may fail:

```ts
import { rejectionFormatter } from "@shivaedev/effect-trpc/rejection-formatter.ts";
import { rejectWith } from "@shivaedev/effect-trpc/rejection.ts";
import superjson from "superjson";

class Conflict extends Schema.TaggedError<Conflict>()("Conflict", {
  field: Schema.String,
  message: Schema.String,
}) {}

const publicTRPC = initTRPC.create({
  errorFormatter: rejectionFormatter,
  transformer: superjson,
});
const publicProcedure = adapter.procedure(
  publicTRPC.procedure,
  makeRequestServices(() => Layer.empty),
);
const rename = publicProcedure.input(Schema.Struct({ name: Schema.String })).mutation(function* ({ name }) {
  if (name === "taken") {
    return yield* Effect.fail(new Conflict({ field: "name", message: "Name is taken" })).pipe(rejectWith(Conflict));
  }
  return `renamed:${name}`;
});

export const publicRouter = publicTRPC.router({ rename });
export type PublicRouter = typeof publicRouter;
```

With the formatter installed, the declared failure crosses as `data.rejection`:

```json
{
  "_tag": "Conflict",
  "field": "name",
  "message": "Name is taken"
}
```

`rejectWith` encodes only the declared fields into a `RejectionError`; the error's cause is absent. The error message is its string `message`, or its `_tag` when there is no string message. Successful results, undeclared failures and defects pass through `rejectWith` unchanged. A failure the schema cannot encode becomes a defect.

The tag selects the default tRPC code and HTTP status:

| Tag | tRPC code | HTTP status |
| --- | --- | --- |
| `NotFound` | `NOT_FOUND` | 404 |
| `Unauthorized` | `UNAUTHORIZED` | 401 |
| `Forbidden` | `FORBIDDEN` | 403 |
| `Conflict` | `CONFLICT` | 409 |
| `PreconditionFailed` | `PRECONDITION_FAILED` | 412 |
| `TooManyRequests` | `TOO_MANY_REQUESTS` | 429 |
| `AuthUnavailable` | `SERVICE_UNAVAILABLE` | 503 |
| Any other tag, including `BadRequest` | `BAD_REQUEST` | 400 |

Pass `rejectWith(schema, { code: (tag) => ... })` to choose the code. If the application has its own formatter, return `withRejection(shape, error)` from it; existing shape fields are preserved.

An input validation failure uses the same data location. The formatter sends a `BadRequest` with the first issue's message, its dotted field path such as `address.city` or `tags.1`, and `invalidInput: true`. A whole-input issue has no `field`.

For `Schema.Struct({ name: Schema.NonEmptyString })` and input `{ name: "" }`, the rejection is:

```json
{
  "_tag": "BadRequest",
  "field": "name",
  "invalidInput": true,
  "message": "Expected a value with a length of at least 1"
}
```

`invalidInput` is reserved for input validation. A declared rejection schema cannot encode that field, and the formatter strips it from a manually constructed declared rejection. The input failure still decodes as a `BadRequest` schema that has `message` and an optional `field`.

An operation declared with `@shivaedev/effect-contract` supplies an error schema too. Use `rejectWith(operation.error)` on the server and `decodeRejection(operation.error)` on the client. The generated rejection class and its fields survive that round trip; a contract without declared rejections leaves other failures opaque. This reuses the error vocabulary without changing the application's tRPC transport.

### Every client failure: read or decode the rejection

Keep the rejection Schema in a shared module the client can import. The `Conflict` class above belongs in that module; the client needs the router's type and the rejection Schema, rather than the server runtime. With `PublicRouter` exported from `router.ts` and `Conflict` exported from `rejections.ts`, a client call looks like this:

```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Option } from "effect";
import { decodeRejection, rejectionOf } from "@shivaedev/effect-trpc/client/rejection.ts";
import superjson from "superjson";
import { Conflict } from "./rejections.ts";
import type { PublicRouter } from "./router.ts";

const client = createTRPCClient<PublicRouter>({
  links: [httpBatchLink({ transformer: superjson, url: "/trpc" })],
});

try {
  await client.rename.mutate({ name: "taken" });
} catch (error) {
  const encoded = rejectionOf(error);
  const decoded = decodeRejection(Conflict)(error);
  const inputDidNotParse = Option.exists(encoded, (rejection) => rejection.invalidInput === true);
}
```

`encoded` is an `Option` holding the tagged encoded data. `decoded` is an `Option<Conflict>` holding a decoded class instance. For this call, both contain the `Conflict` rejection and `inputDidNotParse` is false. Both Options are `None` when there is no tagged rejection; decoding also returns `None` when the client schema does not accept it. `rejectionOf` rejects a present `invalidInput` value other than `true`. Client decoding requires a schema with no decoding-service requirements.

### Once per application: explicit errors and instrumentation

An explicit `TRPCError` failure retains its code and message. For example, `yield* notFound("Order not found")` from `errors.ts` produces a `NOT_FOUND` failure without declared rejection data.

Use `mapError` when an application failure should become a public transport error:

```ts
import { TRPCError } from "@trpc/server";
import { Data } from "effect";

class OrderMissing extends Data.TaggedError("OrderMissing")<{ readonly message: string }> {}

const mappedAdapter = makeEffectTRPC({
  runtime,
  mapError: (error) =>
    error instanceof OrderMissing
      ? new TRPCError({ code: "NOT_FOUND", message: error.message })
      : undefined,
});
```

The mapper receives the procedure path and an `origin` of `failure` or `defect`. Returning `undefined` keeps the internal error redacted. A defect thrown by the mapper is also redacted. Pure Effect interruption maps to `CLIENT_CLOSED_REQUEST` with `Request cancelled`.

`instrument(effect, procedure)` wraps resolver work and can read request services. `instrumentStream(stream, procedure)` wraps subscription streams. Both receive the procedure path and kind; an Effect-instrumentation defect is redacted.

### Once per test suite: the real router caller

Create the test helper in the application's test support. These definitions continue the first complete example:

```ts
import { expect } from "@effect/vitest";
import { makeTrpcIt } from "@shivaedev/effect-trpc/testing/vitest.ts";

const TestLive = Layer.succeed(Orders, {
  find: (id) => Effect.succeed({ id, name: "Test lamps" }),
});
const it = makeTrpcIt({
  adapter,
  createCaller: (context = { requestId: "default" }) => router.createCaller(context),
  layer: TestLive,
});

it.effectTRPC("reads the order for this request", function* (trpc) {
  const result = yield* trpc({ requestId: "other" }).order({ id: "order-1" });
  expect(result).toEqual({ order: { id: "order-1", name: "Test lamps" }, requestId: "other" });
});
```

The test yields the real router's caller as an Effect. Test services override matching runtime services, while other runtime services remain available. `trpc.order(...)` uses the default context; `trpc(context).order(...)` chooses another context. Caller inputs, outputs and context retain their types.

Use `makeTrpcHarnessIt` to return application fixtures together with the caller:

```ts
import { makeTrpcHarnessIt } from "@shivaedev/effect-trpc/testing/vitest.ts";

const harnessIt = makeTrpcHarnessIt({
  adapter,
  createCaller: (context = { requestId: "default" }) => router.createCaller(context),
  layer: TestLive,
  makeHarness: (trpc) => Effect.map(Orders, (orders) => ({ orders, trpc })),
});

harnessIt.effectTRPC("provides the caller and fixture services", function* ({ orders, trpc }) {
  const expected = yield* orders.find("order-1");
  const result = yield* trpc.order({ id: "order-1" });
  expect(result.order).toEqual(expected);
});
```

Harness creation runs with the test Layer's services. The testing module delegates to `@shivaedev/effect-test`; its runner options include `around` and `clock`. See [Effect Test](https://github.com/ShivaeDev/platform/tree/main/packages/effect-test#readme) for the runner's lifecycle and clock model.

For a caller wrapper outside Vitest, `makeEffectCaller(adapter, caller, services)` turns an existing caller into an Effect-shaped caller. `makeEffectCallerFactory(adapter, createCaller, services)` adds the context-selection form used above. The adapter's `runWithServices(services, evaluate)` is the bridge for those overrides:

```ts
const resultWithOverride = await adapter.runWithServices(
  Context.make(Orders, { find: (id) => Effect.succeed({ id, name: "Override lamps" }) }),
  () => router.createCaller({ requestId: "ambient" }).order({ id: "order-1" }),
);
```

The supplied services override matching application runtime services; other runtime services remain available. Request services still come from the caller's context.

### API by module

Import each name from its defining `@shivaedev/effect-trpc/<module>.ts`; there is no root entry.

| Module | Public names |
| --- | --- |
| `adapter.ts` | `makeEffectTRPC`, `EffectTRPCAdapter` (`procedure`, `runWithServices`), `EffectTRPCRuntime`, `MakeEffectTRPCOptions` |
| `procedure.ts` | `EffectProcedureBuilder`: `input`, `output`, `query`, `mutation`, `subscription` |
| `request-services.ts` | `makeRequestServices`, `extendRequestServices`, `EffectProcedureRequestServices` |
| `request-signal.ts` | `RequestSignal`, an Effect reference typed as `AbortSignal \| undefined` |
| `types.ts` | `ProcedureKind`, `ProcedureInfo`, `EffectTRPCErrorContext`, `EffectTRPCErrorMapper`, `EffectTRPCInstrument`, `EffectTRPCStreamInstrument` |
| `errors.ts` | `fail`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `preconditionFailed`, `internalServerError` |
| `rejection.ts` | `rejectWith`, `rejectionCode`, `RejectionError`, `DeclaredRejection`, `RejectWithOptions` |
| `rejection-formatter.ts` | `rejectionFormatter`, `withRejection`, `RejectionData`, `RejectionErrorShape` |
| `client/rejection.ts` | `rejectionOf`, `decodeRejection`, `EncodedRejection` |
| `testing/caller.ts` | `makeEffectCaller`, `makeEffectCallerFactory`, `EffectCaller`, `EffectCallerFactory` |
| `testing/vitest.ts` | `makeTrpcIt`, `makeTrpcHarnessIt` |
| `testing/types.ts` | `CallerOptions`, `CallerResult`, `MakeTrpcItOptions`, `MakeTrpcHarnessItOptions`, `TrpcIt`, `TrpcTest`, `TrpcTester`, `TrpcHarnessIt`, `TrpcHarnessTest`, `TrpcHarnessTester` |
| `testing/any-test-layer.ts` | `AnyTestLayer` |

`rejectWith` removes the declared schema types from the Effect's error channel and adds `RejectionError`.

### Install, runtime ownership and limits

```sh
pnpm add @shivaedev/effect-trpc @trpc/server@11.18.0 effect@4.0.0-rc.112
```

Use the exact peer versions in this package's `package.json`. Node.js 24 or later is required. The rejection example also uses `superjson`; configure the same transformer on the tRPC client.

```sh
pnpm add @trpc/client@11.18.0 superjson@2.2.6
pnpm add --save-dev @effect/vitest@4.0.0-rc.112 vitest@4.1.11
```

The Vitest dependency is optional unless you import the testing modules. The application owns runtime shutdown:

```ts
await runtime.dispose();
```

Choose an application server and tRPC transport separately. The rejection tests exercise tRPC's fetch handler and client in process; the cancellation test exercises a caller signal and Stream iterator. Those checks do not establish deployed HTTP or WebSocket disconnect behavior through a host or proxy. Test that boundary in the consuming application.

For the package's design priorities, read [north star](https://github.com/ShivaeDev/platform/blob/main/packages/effect-trpc/docs/north-star.md). Implementation status, next work and maintainer questions live in the [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/effect-trpc/docs/roadmap.md).
