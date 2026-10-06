# @shivaedev/test-story

Tests that read like short English stories and run the real engine. A spec names its setup in domain words, acts through the application's verbs and lets the engine run, so a human sees at a glance what is tested and an agent writes fewer lines to test more of the stack.

## Why you want this

When agents write most of the code, test files grow into hundreds of lines nobody reads. Each test rebuilds its setup by hand, mocks whatever was too much work to build, and hides what it actually checks. A story test holds only what is specific to it:

```ts
bakery.it("steps until the condition holds", [ovenIsLit(), hasDough(3)], function* ({ oven }) {
  expect(yield* oven.bakesEverything()).toEqual({ loaves: 3, minutes: 3 });
});
```

That is a whole test. `bakery.it` comes from the bakery's story kit. The list holds its traits, `ovenIsLit()` and `hasDough(3)`, which are written once and shared by every spec. `oven.bakesEverything()` is a verb that runs the bakery's real code until the dough is gone. Every story runs the whole engine, so each test also checks the parts its author never thought to mock, and because a spec reads as English, a sloppy test stands out in review.

When a story fails, it prints itself. One of this package's own failing stories expects 2 loaves from one ball of dough, and the test fails with this message:

```text
loaves: expected 1 to be 2 // Object.is equality

╭─ test-story: how to read the story below
│ "given" lines are the test's traits, the other lines were told by verbs and engine steps as they ran, and ✗ marks
│ where the test stopped. The traits, verbs and steps live in the bakery story kit that this test imports.
╰─

  given  the oven is lit
  given  the baker has 1 balls of dough
         1m a loaf comes out of the oven
✗        the test failed after the line above
         at src/test-support/failingStories.ts:10:59

The bakery when the test failed:
{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":1,"minute":1,"orders":[],"ovenLit":true,"overfired":false,
"smoking":false,"starter":false}

Rerun: vitest run src/test-support/failingStories.ts -t "Bakery Story: marks where an assertion stopped the story"
```

The first line is the assertion's own message. The box under it tells a reader who has never seen the package how to read what follows. Then comes the story: the two traits the test named, the line the bakery told as it baked, and a `✗` where the test stopped, with the spec line it stopped at. Last come the bakery's whole state at that moment and the command that reruns the test, so the failure alone is enough to find the cause.

## Using it

### How to think about it

An application has an **engine**: the real thing a test drives, such as a bakery simulation, a game store or a service with its database. A **story** is one test's run of a fresh engine. It starts from **traits**, sentences of setup in domain words that each change the engine, and goes on through **verbs**, the entry points a user or caller reaches, such as `baker.kneads(2)` or `oven.bakesEverything()`. The engine may also run on its own, one **step** at a time, until something the test waits for holds. Every trait tells a line, and verbs and steps tell what they do, so the story is both the plan the test gave and the trace of what happened, in order.

Every story belongs to a **genre**, the kind of engine it runs. The kit names each of its tests after its genre, such as `Bakery Story: steps until the condition holds`, so a report shows which engine a test runs and one run can pick the bakery's stories and leave the others.

The package runs on Effect and Vitest, but an engine needs neither: every hook, trait and test body may be a plain function. A hook that needs a service or fails with a typed error is a generator function that yields Effects, and the kit runs it, so no definition writes `Effect.gen`.

The work splits into three layers, and each is written by a different hand at a different time:

1. **Once per engine**, a story kit in `test-support/` says how to create the engine, which services it needs, and how to seed, step and show it.
2. **Once per feature**, traits and verbs in the kit name that feature in domain words.
3. **In every test**, a spec tells a story with the kit's `it` and checks what a user would see.

### 1. Once per engine: the story kit

`storyKit(definition)` from `@shivaedev/test-story/storyKit.ts` turns one definition into the kit. Every type, the engine's, the stages', the verbs' and the services', is inferred from it.

```ts
export const bakery = storyKit({
  after: {
    *kitchen(state) {
      if (state.bowls === 0) {
        return yield* new NoBowls();
      }
      state.capacity = state.bowls * DOUGH_PER_BOWL;
    },
  },
  create: emptyBakery,
  layer: Supplier.layer,
  name: "bakery",
  run: {
    diagnose: stillWaiting,
    failed: ovenTrouble,
    maxSteps: 60,
    *step(state, tell) {
      state.minute += 1;
      if (state.overfired) {
        return yield* new BurntLoaf({ minute: state.minute });
      }
      state.dough += state.starter ? 0 : -1;
      state.loaves += 1;
      tell(`${state.minute}m a loaf comes out of the oven`);
    },
  },
  stages: ["kitchen", "pantry"],
  verbs: (state, story) => ({
    baker: {
      kneads: (count: number) => {
        story.tell(`the baker kneads ${count} balls of dough`);
        state.dough += count;
      },
    },
    oven: {
      bakesEverything: (maxSteps?: number): Effect.Effect<BakeReport, BurntLoaf> =>
        story.runUntil((current) => current.dough === 0, { maxSteps }).pipe(Effect.map(() => ({ loaves: state.loaves, minutes: state.minute }))),
    },
  }),
});
```

This is the bakery kit this package tests itself with. `emptyBakery`, `stillWaiting` and `ovenTrouble` are plain functions beside it. `kitchen` and `step` are generators because they fail with typed errors, `NoBowls` and `BurntLoaf`.

| Hook | Says |
| --- | --- |
| `name` | What the engine is called in failures, "the bakery", and the kit's genre, "Bakery Story". |
| `create()` | A fresh engine. Every story starts from a new one. |
| `layer` | Optional. The Effect layer that provides every service the hooks, traits and test bodies use. A hook that needs a service the layer does not provide does not compile, and neither does a test whose traits or body need one. |
| `stages` | The order traits are applied in. A trait names its stage, and one that names a stage the kit does not declare does not compile. |
| `after` | Optional. A hook per stage that runs once that stage's traits are applied, even when no trait names the stage, so a value it derives is ready before a later stage reads it. Its typed failure fails the test. |
| `run` | Optional. What `story.runUntil` needs: `step(engine, tell)` advances the engine once and tells what happened, `maxSteps` caps one run, `failed(engine)` returns a sentence when the engine is in a state it cannot recover from, and `diagnose(engine)` says why it has not finished. |
| `inspect` | Optional. The part of the engine a failure prints. Without it, the failure prints the whole engine. |
| `verbs(engine, story)` | The entry points a test acts through. A verb that runs the engine returns the Effect from `story.runUntil`. |

Every test of the kit is named `Bakery Story: <its name>`, so `vitest run -t "Bakery Story: "` runs only the bakery's stories with no setup. A project that splits runs by Vitest tags can also tag them:

```ts
import { genreTags } from "@shivaedev/test-story/genreTags.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { tags: genreTags("bakery", "mill") },
});
```

`genreTags(...kitNames)` declares one tag per kit, named after it: `bakery-story` and `mill-story` here, and `game-store-story` for a kit named "game store". A kit tags its tests only with a genre the config declares, because Vitest refuses a test whose tag the config leaves out, so a config without the line runs every story untagged and prints nothing about it. With the tags declared, `vitest run --tags-filter=mill-story` runs the mill's stories and skips the bakery's, and `--tags-filter` takes any of Vitest's tag expressions, such as `'!mill-story'`. A root config that runs the package's projects by extending its config gets these tags through [`inheritTags`](https://github.com/ShivaeDev/platform/tree/main/packages/quality#inherited-tags) from `@shivaedev/quality`, because Vitest does not pass an extended config's tags on.

### 2. Once per feature: traits and verbs

A trait is a line and a change, tagged with a stage:

```ts
export function hasDough(count: number) {
  return bakery.trait("pantry", `the baker has ${count} balls of dough`, (state) => {
    if (count > state.capacity) {
      throw new Error(`the bowls hold only ${state.capacity}`);
    }
    state.dough = count;
  });
}

export function hasFlourDelivered(sacks: number) {
  return bakery.trait("pantry", `the supplier has delivered ${sacks} sacks of flour`, function* (state) {
    const supplier = yield* Supplier;
    yield* supplier.deliver(sacks);
    state.flour = sacks;
  });
}

export function morningShift() {
  return bakery.traits(ovenIsLit(), hasBowls(1));
}
```

`hasDough` is a plain function. `hasFlourDelivered` is a generator because it reaches the `Supplier` service, which the kit's layer provides. `traits(...)` bundles traits into one, so a setup that recurs gets one name. A test may name traits in any order: `[hasDough(6), hasBowls(2)]` fills the bowls only after the kitchen has them.

A trait that throws, fails or dies refuses the setup instead of seeding a state the application could never reach. This package's failing story `bakery.it("marks the trait that refused", [ovenIsLit(), hasDough(4), hasBowls(1)])` asks for more dough than one bowl holds and fails with:

```text
the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3
help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait
      in the bakery story kit if this bakery should be possible.

╭─ test-story: how to read the story below
│ "given" lines are the test's traits, the other lines were told by verbs and engine steps as they ran, and ✗ marks
│ where the test stopped. The traits, verbs and steps live in the bakery story kit that this test imports.
╰─

  given  the oven is lit
✗ given  the baker has 4 balls of dough
         refused at src/test-support/failingStories.ts:13:57
  given  the bakery has 1 bowls

The bakery when the test failed:
{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":true,"overfired":false,
"smoking":false,"starter":false}

Rerun: vitest run src/test-support/failingStories.ts -t "Bakery Story: marks the trait that refused"
```

The first line names the trait and what it threw, which the error also keeps as its `cause`, and the `help:` line says what to change. The `✗` marks the trait that refused, and the line under it points at the spec line that named it. A trait that fails with a string, a plain object or a tagged error prints by its content, never as `[object Object]`, and an interrupted trait stays interrupted.

A verb that a feature adds goes into the kit's `verbs`. It acts through the engine's real entry point and tells a line, so the story shows it.

### 3. In every test: a spec

```ts
bakery.it("tells each step into the story", [ovenIsLit()], function* ({ baker, oven, story }) {
  baker.kneads(2);
  yield* oven.bakesEverything();

  expect(story.lines).toEqual([
    "the oven is lit",
    "the baker kneads 2 balls of dough",
    "1m a loaf comes out of the oven",
    "2m a loaf comes out of the oven",
  ]);
});
```

`kit.it(name, traits, body, options)` declares one Vitest test, named after the kit's genre: `Bakery Story: tells each step into the story`. It starts a fresh engine, seeds the traits stage by stage and runs the body with the kit's verbs and the `story`: its `engine`, `lines`, `tell(line)` and `runUntil`. The body's second argument is Vitest's test context. A body that yields Effects, such as a verb that runs the engine, is a generator, and one that yields nothing is a plain function. A test that only checks that its traits refuse may leave the body out. `options` is a timeout in milliseconds or Vitest's test options, whose own `tags` join the genre tag when the config declares it. `it.fails`, `it.only`, `it.skip`, `it.runIf(condition)` and `it.skipIf(condition)` work as they do in Vitest.

A spec starts a story, acts through verbs and checks what a user would see. When it needs a setup or an action the kit lacks, add a trait or verb to the kit instead of building it in the spec.

### Running the engine

`story.runUntil(condition, { maxSteps })` returns an Effect that asks three questions before every step:

1. `run.failed` returns a sentence: it dies with it, even when the condition also holds.
2. The condition holds: it succeeds.
3. `maxSteps` steps have run, or the kit's `run.maxSteps` when the call names none: it dies with `run.diagnose`.

```text
the bakery ran 12 steps and never reached what runUntil waits for: 1 balls of dough still wait after 12 minutes: the
  sourdough starter never runs out
help: either the bakery never gets there, so check the setup and the engine, or it needs more steps, so pass a larger
      maxSteps to runUntil.
```

That is what `oven.bakesEverything(12)` dies with when the baker keeps a sourdough starter, so the dough never runs out. The typed failures of `step`, `failed`, `diagnose` and the condition stay in the Effect's error channel: a step that fails with `BurntLoaf` gives the test a `BurntLoaf` to assert on. A kit without `run` hooks dies with a message that says to add them.

### When a story fails

When a story's test fails, for any reason, the story is added to its first error, as in the examples above:

- a short guide to reading the story, in a box;
- every line in order, traits marked `given`;
- `✗` after the last line, on the trait that refused, or alone when the test failed before the story told a line, and under it the spec line where the test stopped or that named the refusing trait;
- the engine's state from `inspect` as JSON, broken between its fields to fit 120 columns. State longer than 2,000 characters is written to `node_modules/.cache/test-story/` under the working directory, and the failure names the file;
- the command that reruns the test, with `-t` on a second line when one line would pass 120 columns.

The package breaks what it prints at 120 columns, between words or JSON fields, and prints the story's own lines whole. A passing test adds nothing. A typed failure with no message, such as an `after` hook's `NoBowls`, prints by its tag.

### Install and limits

```sh
pnpm add --save-dev @shivaedev/test-story @effect/vitest effect vitest
```

`@effect/vitest`, `effect` and `vitest` are peers, so the application's own versions run the stories.

- The package runs inside Vitest. The story reaches the failure by rewriting the first error's message in Vitest's `onTestFailed` hook.
- A kit's `it` is created when the kit is defined, so a kit lives in a module that only Vitest test files import.
- `inspect` runs after the test has failed, so it reads the engine synchronously.
- The spec line under the `✗` is found by matching the spec's path in the failure's stack, or else in the call site of the last line the story told or the last `runUntil`. A failure raised inside an Effect that the spec does not call directly may have none.
- The package is built for ShivaeDev applications and may change without a deprecation period.
