# @shivaedev/effect-test

Effect tests should spend their lines on the behavior they check. This package gives ordinary tests and reusable fixtures one Vitest runner, so a generator can use the application's services and a controlled clock without repeating the runner around every test.

## Why you want this

Wrapping every body in `Effect.gen` hides the test's work, and copying a runner into each fixture makes service and clock setup drift. Pass the generator itself and read the test from top to bottom:

```ts
import { expect } from "@effect/vitest";
import { Clock } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { it } from "@shivaedev/effect-test/it.ts";

it.effect("advances the test's time", function* () {
  expect(yield* Clock.currentTimeMillis).toBe(0);
  yield* TestClock.adjust("1 second");
  expect(yield* Clock.currentTimeMillis).toBe(1000);
});
```

That is a whole test. The body starts at time zero and advances its clock by one second. For a suite that needs services, the same package makes a tester from a Layer and a harness, so the suite defines its plumbing once and each spec keeps its own work.

## Using it

### How to think about it

There are two ways to enter the runner. `it.effect` and `it.live` are the ordinary testers: their body receives Vitest's test context and uses services it provides inside its own Effect. `makeEffectIt` defines a tester for a reusable fixture: its body receives a harness first, then the test context, and can yield the services its Layer provides.

A **Layer** describes how to acquire the fixture's services. `makeEffectIt` builds it in a Vitest worker fixture and retains the resulting Effect **Context**, the map from service keys to service values. A **harness** is the value made for one test using those services. It can hold a service, a fixture identifier or the domain entry points the test needs. The **test context** is Vitest's context, with the test's name, assertion helpers and hooks; it is a different thing from Effect's Context.

Keep the two lifetimes separate. The worker owns the acquired Layer and its scope. Each test makes its harness and runs its body in a separate scope. A shared service can retain mutable state across tests; a fresh harness alone does not reset it. Put application-state isolation in the fixture that owns that state, such as a database transaction wrapper.

The work usually splits into two parts:

1. Once per fixture, define its Layer, `makeHarness` and, when needed, an `around` wrapper in test support.
2. In every test, write the generator and the assertions. For a test with no reusable fixture, use `it.effect` directly.

### 1. Once per fixture: services and the harness

```ts
import { expect } from "@effect/vitest";
import { Clock, Context, Effect, Layer } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";

class Token extends Context.Service<Token, string>()("test/Token") {}

const { effectApp } = makeEffectIt({
  layer: Layer.succeed(Token, "from-layer"),
  makeHarness: (context) => Effect.gen(function* () {
    return {
      name: context.task.name,
      token: yield* Token,
    };
  }),
});

effectApp("reads the fixture's services", function* (harness, context) {
  expect(harness.token).toBe("from-layer");
  expect(harness.name).toBe(context.task.name);
  expect(yield* Token).toBe("from-layer");
});
```

The Layer supplies `Token`. `makeHarness` runs for the test and reads that same service; the generator receives its result and can also yield `Token` directly. Harness fields and provided services keep their types. A body that requires a service the Layer does not provide does not type-check.

A fixture that needs no services uses `Layer.empty`. This separate module
replaces the token fixture above:

```ts
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";

const { effectApp } = makeEffectIt({
  layer: Layer.empty,
  makeHarness: () => Effect.succeed({ shelf: 0 }),
});

effectApp("uses a harness without services", function* (harness) {
  expect(harness.shelf).toBe(0);
});
```

There is no placeholder service. The harness is still inferred, and a body that tries to yield `Token` from this fixture does not compile. The Layer itself must have no unmet service requirements: compose its dependencies before passing it to the factory.

#### Wrapping the harness and body

This alternative token fixture adds a tracing wrapper:

```ts
import { expect } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";

class Token extends Context.Service<Token, string>()("test/Token") {}

const { effectApp } = makeEffectIt({
  around: (effect) => Effect.withSpan(effect, "test.token"),
  layer: Layer.succeed(Token, "from-layer"),
  makeHarness: () => Token.asEffect(),
});

effectApp("reads the harness", function* (token) {
  expect(token).toBe("from-layer");
});
```

`around` receives the Effect that makes the harness and then runs the body. The wrapper also has the Layer's services. This is where a fixture composes its tracing or transaction boundary. The database package owns whether that transaction rolls back; this runner does not add a database policy. The later examples use the first token fixture, whose harness contains `token` and `name`.

`@shivaedev/effect-prisma` and `@shivaedev/effect-trpc` build their testing helpers on this factory. `@shivaedev/test-story` builds domain stories above it and owns traits, verbs, engine stepping and failure narration. Use those helpers when the test needs their vocabulary; use this runner when defining the fixture underneath.

### 2. In every test: the generator

```ts
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";

it.effect("reads an Effect result", function* ({ task }) {
  expect(task.name).toBe("reads an Effect result");
  expect(yield* Effect.succeed(3)).toBe(3);
});

it.effect("accepts an Effect-returning body", () =>
  Effect.sync(() => expect(3).toBe(3)),
);

it.effect.each([1, 2])("passes the case %s", function* (count) {
  expect(yield* Effect.succeed(count)).toBe(count);
});
```

The ordinary body receives Vitest's context. An `each` body receives the table case instead. Both generator and Effect-returning bodies are accepted. `it` itself remains the plain Vitest tester.

For a fixture's `effectApp.each`, the arguments are the case, harness and context:

```ts
effectApp.each(["alpha", "beta"])("checks %s", function* (item, harness, context) {
  expect(context.task.name).toContain(item);
  expect(harness.token).toBe("from-layer");
});
```

This uses the token fixture from the first example. Case and harness types are inferred. The fixture tester takes generator bodies; the ordinary `it.effect` and `it.live` testers also accept an Effect-returning function.

### Choosing which clock runs the test

`it.effect` uses TestClock; `it.live` uses live time. A fixture defaults to `clock: "test"`. Its factory may choose `clock: "live"`, and a single test may override the factory in either direction:

```ts
effectApp("reads live time", function* () {
  expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
}, { clock: "live" });
```

The override changes the per-test environment used by the wrapper, harness and body. TestConsole is installed for both clock choices.

Worker acquisition is separate: a Layer that reads the default Clock while it is being built sees live time, even when its tests use TestClock. A fiber started during that acquisition retains its worker environment, so advancing a test's clock does not advance that fiber's timers. A Layer that supplies its own Clock also supplies that service through its Context; the test's clock option chooses the outer environment and does not replace services explicitly supplied by the fixture.

### Waiting for a typed readiness condition

`eventually(effect, options)` retries the Effect's typed failures until it succeeds or uses its retry budget. Under TestClock it advances time with `TestClock.adjust`; under live time it retries with `Schedule.spaced`.

```ts
import { eventually } from "@shivaedev/effect-test/eventually.ts";

effectApp("reaches the selected time", function* () {
  const readyAt = yield* eventually(
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      return now >= 50 ? now : yield* Effect.fail("too-early");
    }),
    { interval: "7 millis", times: 8 },
  );

  expect(readyAt).toBe(56);
});
```

The attempts see 0, 7, 14 and subsequent multiples of 7 through 56 milliseconds. `times` counts retries after the initial attempt, so `times: 0` tries once. When the budget runs out, the final typed failure remains the failure.

A thrown assertion is a defect, so it escapes on the first attempt. Interruption also escapes immediately. Capture an assertion with `Effect.try` only when its failure means the state is not ready yet:

```ts
effectApp("retries a readiness assertion", function* () {
  let attempts = 0;

  yield* eventually(
    Effect.try(() => {
      attempts += 1;
      expect(attempts).toBe(3);
    }),
    { interval: "1 millis", times: 3 },
  );

  expect(attempts).toBe(3);
});
```

This distinction applies under both clocks. The helper preserves the Effect's success, error and service types.

### API

Import the module that defines the name; the package has no root entry.

| Module | Exports |
| --- | --- |
| `@shivaedev/effect-test/it.ts` | `it`, with generator-aware `effect` and `live` testers. |
| `@shivaedev/effect-test/vitest.ts` | `makeEffectIt({ layer, makeHarness, around?, clock? })`, returning `{ effectApp }`. |
| `@shivaedev/effect-test/eventually.ts` | `eventually(effect, options?)` and `EventuallyOptions`. |
| `@shivaedev/effect-test/any-test-layer.ts` | `AnyTestLayer` and `buildTestLayer(layer, scope)`, an Effect that builds the Layer's service Context in the supplied scope. |
| `@shivaedev/effect-test/types.ts` | `EffectClock`, `EffectTestOptions`, `EffectTest`, `EffectTester`, `MakeEffectItOptions`, `MakeEffectItResult`, `EffectItTest`, `EffectItTester` and `EffectIt`. |

`effectApp(name, body, options?)` takes `(harness, context)`. Its `each(cases)` takes `(item, harness, context)`. Options are a timeout in milliseconds or Vitest test options with an optional `clock`.

`it.effect` and `it.live` take `(name, body, options?)`; options are a timeout or Vitest test options. A regular body takes the context; an `each` body takes the case. These testers and `effectApp` expose `each`, `fails`, `only`, `runIf`, `skip` and `skipIf`.

`EventuallyOptions` has `interval?: Duration.Input` and `times?: number`. The default interval is `"10 millis"`; omitting `times` leaves retries unbounded.

### Install, setup and limits

```sh
pnpm add --save-dev @shivaedev/effect-test @effect/vitest@4.0.0-rc.112 effect@4.0.0-rc.112 vitest@4.1.11
```

The package declares `effect` as a peer and `@effect/vitest` as an optional peer. The Vitest runner modules require `@effect/vitest`; install it when using them. The package requires Node.js 24 or later. Use peer versions compatible with the package's `package.json`.

- Define a fixture tester in test support and import it from Vitest tests. Calling `makeEffectIt` declares a Vitest fixture; it is not an application runtime factory.
- The Layer is shared within its worker fixture. Reset application state in the harness or compose the fixture's own isolation wrapper when tests need it.
- TestClock controls its Effect environment. It does not establish how external timers, real HTTP or a database behave.
- An unbounded readiness poll can run until Vitest ends the test. Set a retry budget when the condition may never become true.
- Compiler tests prove service requirements and inferred types; runtime tests prove the exercised clock and failure paths. Neither is evidence that a consumer's composed application has been validated.
