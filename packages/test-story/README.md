# @shivaedev/test-story

Tests that read like short English stories and run the real engine. A spec names its setup in domain words, acts through the application's verbs and lets the engine run, so a human sees at a glance what is tested and an agent writes fewer lines to test more of the stack.

## Why you want this

When agents write most of the code, test files grow into hundreds of lines nobody reads. Each test rebuilds its setup by hand, mocks whatever was too much work to build, and hides what it actually checks. A story test holds only what is specific to it:

```ts
it("bakes every ball of dough once the oven is lit", () => {
  const { oven } = newBakery(ovenIsLit(), hasDough(3))

  expect(oven.bakesEverything()).toEqual({ loaves: 3, minutes: 3 })
})
```

The traits `ovenIsLit()` and `hasDough(3)` are written once and reused by every spec, `oven.bakesEverything()` runs the bakery's real code, and every story runs the whole engine, so each test also checks the parts its author never thought to mock. Because a spec reads as English, a sloppy test stands out in review.

When a story fails, it prints itself: every line of the setup and of what happened, the spec line behind each, where it stopped, and the engine's state at that moment.

```text
loaves: expected 1 to be 2 // Object.is equality

test-story: this test tells a story over a real bakery. "given" lines are its traits; the other lines were told by verbs and engine steps as they ran, each beside the spec line that caused it when known. ✗ marks where it stopped.
  given  the oven is lit                  src/bakery.spec.ts:30:30
  given  the baker has 1 balls of dough   src/bakery.spec.ts:30:43
         1m a loaf comes out of the oven  src/bakery.spec.ts:32:15
✗        the test failed after the line above

The bakery when the test failed: {"dough":0,"loaves":1,"minute":1,"ovenLit":true}

The traits, verbs and engine steps live in the bakery story kit this test imports. Rerun: vitest run src/bakery.spec.ts -t "bakes every ball of dough once the oven is lit"
```

## Using it

### How to think about it

An application has an **engine**: the real thing a test drives, such as a bakery simulation, a game store or a service with its database. A **story** is one test's run of a fresh engine. It starts from **traits**, sentences of setup in domain words that each change the engine, and goes on through **verbs**, the entry points a user or caller reaches, such as `baker.kneads(2)` or `oven.bakesEverything()`. The engine may also run on its own, one **step** at a time, until something the test waits for holds. Every trait tells a line, and verbs and steps tell what they do, so the story is both the plan the test gave and the trace of what happened, in order.

The work splits into three layers, and each is written by a different hand at a different time:

1. **Once per engine**, a story kit in `test-support/` says how to create the engine, seed it, step it and show its state.
2. **Once per feature**, traits and verbs in the kit name that feature in domain words.
3. **In every test**, a spec tells a story with them and checks what a user would see.

### 1. Once per engine: the story kit

`storyKit(definition)` from `@shivaedev/test-story/storyKit.ts` turns one definition into the kit. Every type, the engine's, the stages' and the verbs', is inferred from it.

```ts
import { storyKit } from "@shivaedev/test-story/storyKit.ts"

const bakery = storyKit({
  after: { kitchen: fitBowls },
  create: emptyBakery,
  inspect: ({ dough, loaves, minute, ovenLit }) => ({ dough, loaves, minute, ovenLit }),
  name: "bakery",
  run: { diagnose: stillWaiting, failed: ovenTrouble, maxSteps: 60, step: bakeOneLoaf },
  stages: ["kitchen", "pantry"],
  verbs: (state, story) => ({
    baker: {
      kneads: (count: number) => {
        story.tell(`the baker kneads ${count} balls of dough`)
        state.dough += count
      },
    },
    oven: {
      bakesEverything: (maxSteps?: number) => {
        story.runUntil((current) => current.dough === 0, { maxSteps })
        return { loaves: state.loaves, minutes: state.minute }
      },
    },
  }),
})

export const newBakery = bakery.start
```

| Hook | Says |
| --- | --- |
| `name` | What the engine is called in failures: "the bakery". |
| `create()` | A fresh engine. Every story starts from a new one. |
| `stages` | The order traits are applied in. A trait names its stage, and one that names a stage the kit does not declare does not compile. |
| `after` | Optional. A hook per stage that runs once that stage's traits are applied, even when no trait names the stage, so a value it derives is ready before a later stage reads it. |
| `run` | Optional. What `story.runUntil` needs: `step(engine, tell)` advances the engine once and tells what happened, `maxSteps` caps one run, `failed(engine)` returns a sentence when the engine is in a state it cannot recover from, and `diagnose(engine)` says why it has not finished. |
| `inspect(engine)` | Optional. The JSON-ish state a failure prints. Without it, the failure prints the engine itself. |
| `verbs(engine, story)` | The objects a test acts through. They tell lines and run the engine through `story`. |

`kit.start(...traits)` creates the engine, tells one line per trait in the order the test names them, applies the traits stage by stage, and returns the verbs with the `story`: its `engine`, its `lines`, `tell(line)` and `runUntil(condition, { maxSteps })`. Export `start` under the domain's name, such as `newBakery`.

Write the kit once, even though `start` is short to call: it is the one place that knows how the engine is created, ordered and stepped, so no spec rebuilds it.

### 2. Once per feature: traits and verbs

A trait is a line and a change, tagged with a stage:

```ts
export function hasDough(count: number) {
  return bakery.trait("pantry", `the baker has ${count} balls of dough`, (state) => {
    if (count > state.capacity) {
      throw new Error(`the bowls hold only ${state.capacity}`)
    }
    state.dough = count
  })
}

export const morningShift = () => bakery.traits(ovenIsLit(), hasBowls(1))
```

`traits(...)` bundles traits into one, so a setup that recurs gets one name. A test may name traits in any order: `newBakery(hasDough(6), hasBowls(2))` fills the bowls only after the kitchen has them.

A trait that throws refuses the setup instead of seeding a state the application could never reach. `start` throws an error whose `cause` is what the trait threw:

```text
the trait "the baker has 5 balls of dough" refused to set up the bakery: the bowls hold only 3
help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait in the bakery story kit if this bakery should be possible.
```

A verb that a feature adds goes into the kit's `verbs`. It acts through the engine's real entry point and tells a line, so the story shows it.

### 3. In every test: a spec

```ts
it("bakes the dough the baker kneads", () => {
  const { baker, oven } = newBakery(ovenIsLit())

  baker.kneads(2)

  expect(oven.bakesEverything()).toEqual({ loaves: 2, minutes: 2 })
})
```

A spec starts a story, acts through verbs and checks what a user would see. When it needs a setup or an action the kit lacks, add a trait or verb to the kit instead of building it in the spec.

### Running the engine

`story.runUntil(condition, { maxSteps })` asks three questions before every step:

1. `run.failed` returns a sentence: it throws, even when the condition also holds.
2. The condition holds: it returns.
3. `maxSteps` steps have run, or the kit's `run.maxSteps` when the call names none: it throws with `run.diagnose`.

```text
the bakery ran 12 steps and never reached what runUntil waits for: 1 balls of dough still wait after 12 minutes: the sourdough starter never runs out
help: either the bakery never gets there, so check the setup and the engine, or it needs more steps, so pass a larger maxSteps to runUntil.
```

### When a story fails

When a test that started a story fails, for any reason, the story is added to its first error, as in the example at the top:

- every line in order, traits marked `given`, each beside the spec line that caused it when the spec was on the call stack;
- `✗` after the last line, or on the trait that refused;
- the engine's state from `inspect`, as one line of JSON. State longer than 2,000 characters is written to `node_modules/.cache/test-story/` under the working directory, and the failure names the file;
- the command that reruns the test.

A passing test adds nothing. A thrown string, plain object or tagged error is printed by its content, never as `[object Object]`. A story started outside a test, such as in a `describe` body, runs the same way and prints nothing.

### Effect

`effectStoryKit(definition)` from `@shivaedev/test-story/effect/storyKit.ts` takes the same definition. Each hook and trait may be a generator function that yields Effects, or a plain function when it needs none; the kit runs generators itself, so a definition never writes `Effect.gen`.

```ts
import { effectStoryKit } from "@shivaedev/test-story/effect/storyKit.ts"

const bakery = effectStoryKit({
  after: {
    *kitchen(state) {
      if (state.bowls === 0) {
        return yield* new NoBowls()
      }
      fitBowls(state)
    },
  },
  create: emptyBakery,
  name: "bakery",
  run: { failed: ovenTrouble, maxSteps: 60, *step(state, tell) { /* may yield* new OutOfFlour(...) */ } },
  stages: ["kitchen", "pantry"],
  verbs: (state, story) => ({
    oven: { bakesEverything: (maxSteps?: number) => story.runUntil((current) => current.dough === 0, { maxSteps }) },
  }),
})

export function hasFlourDelivered(sacks: number) {
  return bakery.trait("pantry", `the supplier has delivered ${sacks} sacks of flour`, function* (state) {
    const supplier = yield* Supplier
    yield* supplier.deliver(sacks)
    state.flour = sacks
  })
}
```

- `start(...traits)` is an Effect. Its error channel holds the typed failures of `create` and of each `after` hook, and it needs their services and the services of the traits it starts with.
- A trait that fails, dies or throws is a broken test, not an expected error: `start` dies with the refusal. An interrupted trait stays interrupted.
- `story.runUntil` keeps the typed failures of `step`, `failed`, `diagnose` and the condition in its error channel, and dies with what `failed` reports or when the step budget runs out.
- Traits and the lines a `runUntil` run tells point at the spec line that called them. A line a verb tells inside an Effect has no location.

### Install and limits

```sh
pnpm add --save-dev @shivaedev/test-story vitest
```

Add `effect` to use `effect/storyKit.ts`; the rest of the package never imports it.

- The package runs inside Vitest. The story reaches the failure by rewriting the first error's message in Vitest's `onTestFailed` hook.
- `inspect` runs after the test has failed, so it reads the engine synchronously.
- A spec line is found by matching the spec's path in a call site's stack, so a line told while the spec is not on the stack has none.
- The package is built for ShivaeDev applications and may change without a deprecation period.
