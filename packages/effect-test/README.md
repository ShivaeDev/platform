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

## `makeEffectIt`

```ts
import { Layer } from "effect"
import { makeEffectIt } from "@shivaedev/effect-test"

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

## `eventually`

Retries until the effect succeeds. Under TestClock it advances time with
`TestClock.adjust`. Under `clock: "live"` it uses `Schedule.spaced`.

```ts
import { eventually } from "@shivaedev/effect-test"

effectApp("sees a delayed write", function* ({ db }) {
  const row = yield* eventually(db.Job.where({ id }).first(), {
    interval: "10 millis",
    times: 50,
  })
  expect(row.status).toBe("ready")
})
```
