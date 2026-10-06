# `@shivaedev/test-story`

The core of a story DSL for tests. A story test names its setup in the domain's words, acts through the application's real entry points, lets the real engine run and checks what a user would see. When it fails, it shows the story that led there.

Each application owns its traits, its verbs and what one step of its engine means. This package owns only the generic shape: a trait, the order a setup is seeded in, the story log and the loop that runs the domain until it settles.

The sync modules need only Vitest. The modules under `effect/` take Effect programs instead of functions and need `effect`, an optional peer. The package is built for ShivaeDev applications and may change without a deprecation period.

## Install

```sh
pnpm add --save-dev @shivaedev/test-story vitest
```

Add `effect` as well to use the modules under `effect/`.

## Traits and seeding

`storyKit<State>()(...stages)` returns `trait`, `traits` and `seed` for one kind of state. A trait is a story line and an `apply` that changes the state, tagged with one of the kit's stages. The stages are part of the kit's type, so a trait or hook that names another stage does not compile.

```ts
import { storyKit } from "@shivaedev/test-story/storyKit.ts"

const kit = storyKit<Bakery>()("kitchen", "pantry")

export const hasBowls = (count: number) =>
  kit.trait("kitchen", `the bakery has ${count} bowls`, (bakery) => {
    bakery.bowls = count
  })

export const hasDough = (count: number) =>
  kit.trait("pantry", `the baker has ${count} balls of dough`, (bakery) => {
    if (count > bakery.capacity) {
      throw new Error(`the bowls hold only ${bakery.capacity}`)
    }
    bakery.dough = count
  })

export const morningShift = () => kit.traits(ovenIsLit(), hasBowls(2))

export function newBakery(...given: readonly BakeryTrait[]) {
  const bakery = emptyBakery()
  const log = kit.seed(bakery, given, { after: { kitchen: fitBowls } })
  return { baker: bakerOf(bakery, log), oven: ovenOf(bakery, log) }
}
```

`traits(...)` bundles traits into one, so a test can name a setup. `seed(state, given, { after })` applies every trait of the first stage, then that stage's `after` hook, then the next stage, so a value the hook derives is ready before a later stage reads it. A hook runs even when no trait names its stage. A test may name its traits in any order: `newBakery(hasDough(6), hasBowls(2))` fills the bowls only after the kitchen has them.

A trait whose `apply` throws refuses the setup instead of seeding it quietly. `seed` throws an error whose `cause` is what the trait threw:

```text
trait "the baker has 5 balls of dough" refused: the bowls hold only 3
```

## The story log

`seed` returns a `StoryLog`: its `lines` and `tell(line)`. The log starts with one line per trait, in the order the test names them, and the application's verbs and steps tell it what happens next.

When the test fails, the story is added to the test's first error:

```text
AssertionError: expected 1 to be 2 // Object.is equality

The story so far:
  the oven is lit
  the baker has 1 balls of dough
  1m a loaf comes out of the oven
```

`storyLog()` registers this with Vitest's `onTestFailed`, so it runs inside a test, which is where `seed` creates its log. `storyLog({ storyOnFailure: false })` makes a log that adds nothing; pass it to `seed` as `log` to seed outside a test.

## Settling

`settle(log, spec)` runs the domain's engine until something true happens, or says why not. Every round asks the spec three questions in order:

1. `failed()` returns an error: `settle` throws it.
2. `settled()` is true: `settle` returns `report()`.
3. `cap` steps have run: `settle` throws `diagnose()` followed by the last 10 lines of the story.

Otherwise it calls `step()` and asks again.

```ts
import { settle } from "@shivaedev/test-story/settle.ts"

const bakesEverything = (within = 60) =>
  settle(log, {
    cap: within,
    diagnose: () => `${bakery.dough} balls of dough still wait after ${bakery.minute} minutes`,
    failed: () => (bakery.ovenLit || bakery.dough === 0 ? undefined : new Error("the oven is cold")),
    report: () => ({ loaves: bakery.loaves, minutes: bakery.minute }),
    settled: () => bakery.dough === 0,
    step: () => bakeOneLoaf(bakery, log),
  })
```

A story that never settles explains itself:

```text
1 balls of dough still wait after 12 minutes
last lines of the story:
  3m a loaf comes out of the oven
  ...
  12m a loaf comes out of the oven
```

## Effect

`@shivaedev/test-story/effect/storyKit.ts` exports `effectStoryKit<Target, R>()(...stages)`, whose traits apply as Effects that need the services `R`. Every trait of one kit needs the same `R`.

```ts
import { effectStoryKit } from "@shivaedev/test-story/effect/storyKit.ts"

const kit = effectStoryKit<Bakery, Supplier>()("kitchen", "pantry")

export const hasFlourDelivered = (sacks: number) =>
  kit.trait("pantry", `the supplier has delivered ${sacks} sacks of flour`, (bakery) =>
    Effect.gen(function* () {
      const supplier = yield* Supplier
      yield* supplier.deliver(sacks)
      bakery.flour = sacks
    }),
  )

export const newBakery = Effect.fnUntraced(function* (...given: readonly BakeryTrait[]) {
  const bakery = emptyBakery()
  const log = yield* kit.seed(bakery, given, { after: { kitchen: (target) => Effect.sync(() => fitBowls(target)) } })
  return { oven: ovenOf(bakery, log) }
})
```

`seed` is an Effect. A trait that fails or dies is a broken test, not an expected error: `seed` dies with the same refusal as the sync kit, so its error channel holds only the failures of its `after` hooks, each hook with its own error type. An interrupted trait stays interrupted.

`settleEffect(log, spec)` from `@shivaedev/test-story/effect/settle.ts` runs the same loop over a spec of Effects. It dies with the error `failed` returns and when the cap is reached. Each member of the spec may fail and need services of its own: their typed failures stay in the error channel, and the result needs the services of all of them.
