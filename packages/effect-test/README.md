# `@shivaedev/effect-test`

A Vitest runner for Effect programs. The test Layer is built once per worker.
Each test gets a fresh Scope, a generator body, and TestClock unless you ask
for the live clock.

Prisma and tRPC testing helpers in this repository are thin wrappers around
`makeEffectIt`. Use this package directly when those wrappers are the wrong
shape.

This package currently targets exact early-access versions of Effect v4. It is
built for ShivaeDev applications and may change without a deprecation period.

## Install

```sh
pnpm add --save-dev @shivaedev/effect-test @effect/vitest effect vitest
```

## `it`

`@shivaedev/effect-test/it.ts` exports the `it` of `@effect/vitest`, whose `effect` and `live`
testers also take the generator itself and run it with `Effect.gen`:

```ts
import { it } from "@shivaedev/effect-test/it.ts"

it.effect("starts at time zero", function* ({ task }) {
  expect(yield* Clock.currentTimeMillis).toBe(0)
})

it.live("waits on the real clock", function* () {
  yield* Effect.sleep("10 millis")
})
```

The body receives the Vitest test context; destructure what it reads. `effect`
installs TestClock and the other test services, `live` keeps the live ones, and
each runs the body in a Scope. A function that returns an Effect works as well,
as with `@effect/vitest`. Each tester supports `each`, `fails`, `only`, `runIf`,
`skip` and `skipIf`; an `each` body receives the table case.

## `makeEffectIt`

```ts
import { Layer } from "effect"
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts"

const { effectApp } = makeEffectIt({
  layer: TestLive,
  makeHarness: () => Effect.succeed({}),
})

effectApp("reads a service from the test Layer", function* (_harness, _context) {
  const movies = yield* Movies
  expect(yield* movies.list()).toEqual([])
})
```

`makeHarness` runs inside the worker Layer and any `around` wrapper, then the
generator receives that value as its first argument.

```ts
const { effectApp } = makeEffectIt({
  layer: DatabaseLive,
  around: (effect) => withTestTransaction(Database, effect),
  makeHarness: () => Database,
})
```

`effectApp` supports `skip`, `skipIf`, `runIf`, `only`, `each`, and `fails`.

## Clock

Tests install TestClock and TestConsole. Pass `clock: "live"` on the factory or
on a single test when the program must use wall-clock time:

```ts
effectApp("talks to a real timer", function* () {
  yield* Effect.sleep("10 millis")
}, { clock: "live" })
```

The worker Layer is acquired and released outside the per-test environment,
using the live clock unless the Layer supplies its own. Fibers started during
Layer acquisition keep that environment; advancing a test's TestClock does not
advance their timers. The selected per-test clock applies to `around`,
`makeHarness`, and the test body.

## `eventually`

Retries typed failures until the effect succeeds. Under TestClock it advances
time with `TestClock.adjust`. Under `clock: "live"` it uses `Schedule.spaced`.
`times` counts retries after the initial attempt; omitting it retries without a
limit. Defects (including thrown assertions) and interruption propagate without
retrying under either clock. Use `Effect.try(() => expect(...))` when an
assertion failure is intentionally a retryable condition.

```ts
import { eventually } from "@shivaedev/effect-test/eventually.ts"

effectApp("sees a delayed write", function* ({ db }) {
  const row = yield* eventually(db.Job.where({ id }).first(), {
    interval: "10 millis",
    times: 50,
  })
  expect(row.status).toBe("ready")
})
```
