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

The package runs on Effect and Vitest, but an engine needs neither: every hook, trait and test body may be a plain function. Use a generator function to yield Effects when a hook needs a service or fails with a typed error; the kit runs it, so no definition needs `Effect.gen`. Creation, stage `after` hooks and traits may also be plain functions that return an Effect directly. The kit runs that Effect in the story's Scope, with the services from its layer.

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
| `outbound` | Optional. A map of exact hostnames to fake server origins for Node fetch and the DOM environment's document requests. |
| `around(effect)` | Optional. Wraps creation, staged seeding and the body; worker Layer acquisition remains outside it. It may require the worker services and per-test Scope. |
| `clock` | Optional. `"test"` by default, or `"live"` for HTTP and DOM stories. A story’s `options.clock` takes precedence. |
| `create()` | A fresh engine. Every story starts from a new one. |
| `layer` | Optional. The worker Effect layer that provides the services hooks, traits and test bodies use. Per-test Scope is already available to creation, staged and run hooks, traits and bodies. A hook that needs a service the layer does not provide does not compile, and neither does a test whose traits or body need one. |
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

`genreTags(...kitNames)` declares one tag per kit, named after it: `bakery-story` and `mill-story` here, and `game-store-story` for a kit named "game store". A kit tags its tests only with a genre the config declares, because Vitest refuses a test whose tag the config leaves out, so a config without the line runs every story untagged and prints nothing about it. With the tags declared, `vitest run --tags-filter=mill-story` runs the mill's stories and skips the bakery's, and `--tags-filter` takes any of Vitest's tag expressions, such as `'!mill-story'`. A root config whose inline projects extend the package's config gets these tags from it, so `--tags-filter` works from the root too.

#### Routing outbound HTTP

When application code calls a hard-coded third-party URL, set `outbound` on its kit to send those requests to a fake server:

```ts
const app = storyKit({
  ...appDefinition,
  outbound: { "github.com": fakeUrl, "api.github.com": fakeUrl },
});
```

`appDefinition` holds the application's kit hooks, and `fakeUrl` is the listening fake server's HTTP or HTTPS origin, such as `http://127.0.0.1:4321`. The map matches exact URL hostnames, across ports. It replaces the destination origin while keeping the request's path, query, method, headers and body. For example, a POST to `https://github.com/login/oauth/access_token` reaches the fake's `/login/oauth/access_token`. In Node stories, other hostnames pass through the previous dispatcher unchanged. In the DOM environment, only loopback hosts (`localhost`, IPv4 loopback addresses and `[::1]`) may pass through without a route; every other hostname must have an `outbound` fake. A refused request fails the story and names its hostname, even when application code catches the fetch error.

Routing uses the global dispatcher that Node's built-in `fetch` already uses. It is installed before `around`, creation, traits and the body, stays active during scoped cleanup, and restores the previous dispatcher after each story, including a failing story. Stories within one worker must run one at a time because that dispatcher is shared; parallelism belongs between workers or inside one story. The DOM environment uses the same routing for host-side Node fetch and document requests, including redirect destinations. It refuses external hosts even when the kit omits `outbound`.

#### Asserting on application traces

Start an in-process host in `create` or a stage's `after` hook, such as `after: { deployment }`. Creation and every `after` hook run without the ambient parent span, so an Effect HTTP handler that captures its context does not inherit a span placed around the story. Their scoped teardown and finalizers retain that detached context. The tracer, services and per-story Scope remain available. Traits, verbs, engine steps and assertions in the story body keep the span supplied by `around`.

This lets an application's story assert that a request starts its own trace: a request without trace headers starts a root trace, and a request with `traceparent` continues that trace. Host startup and cleanup do not join the story's trace.

A kit can collect spans with a native in-memory tracer, or start a fake OTLP receiver and point the application's exporter at it. Keep collection and any exporter flush or bounded wait in the kit's verbs. Assert only after the request span has ended. This small in-memory kit uses Effect's Web Request handler as its host:

```ts
import { Effect, Tracer } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";

const spans: Tracer.NativeSpan[] = [];
const tracer = Tracer.make({
  span: (options) => {
    const span = new Tracer.NativeSpan(options);
    spans.push(span);
    return span;
  },
});

const app = storyKit({
  around: (effect) => effect.pipe(Effect.withSpan("story"), Effect.withTracer(tracer)),
  *create() {
    const context = yield* Effect.context<never>();
    return HttpEffect.toWebHandlerWith(context)(Effect.succeed(HttpServerResponse.text("ok")));
  },
  name: "traced application",
  stages: ["ready"],
  verbs: (handler) => ({
    request: (headers: HeadersInit = {}) => Effect.promise(async () => {
      const response = await handler(new Request("http://app.test/", { headers }));
      await response.text();
      const span = spans.filter((span) => span.kind === "server").at(-1);
      if (span === undefined) throw new Error("The request exported no server span");
      return span;
    }),
  }),
});

app.it("a request is its own root trace", [], function* ({ request }) {
  const storySpan = yield* Effect.currentSpan;
  const span = yield* request();
  expect(span.parent._tag).toBe("None");
  expect(span.traceId).not.toBe(storySpan.traceId);
  expect(span.status._tag).toBe("Ended");
});

app.it("a request continues its supplied trace", [], function* ({ request }) {
  const span = yield* request({ traceparent: "00-1234567890abcdef1234567890abcdef-1234567890abcdef-01" });
  expect(span.traceId).toBe("1234567890abcdef1234567890abcdef");
  expect(span.parent).toMatchObject({ value: { spanId: "1234567890abcdef" } });
});
```

The package's [tracing kit](https://github.com/ShivaeDev/platform/blob/main/packages/test-story/src/test-support/tracingApp.ts) and [stories](https://github.com/ShivaeDev/platform/blob/main/packages/test-story/src/server/hostTracing.spec.ts) also assert that two requests have different trace IDs, request work stays under its request span, and traits and engine steps stay under the story span. The [after-hook stories](https://github.com/ShivaeDev/platform/blob/main/packages/test-story/src/server/afterHostTracing.spec.ts) boot a loopback HTTP host after deployment and check its startup, requests and cleanup against the story trace, while its request verb remains a child of the story span. Detachment only removes the incoming parent: spans that application startup explicitly creates still follow native Effect semantics.

#### Reading OTLP exports

Use `otlpReceiver` from `@shivaedev/test-story/otlpReceiver.ts` in a kit's scoped `create` hook. It listens on an allocated loopback port and closes with the story scope. Point the application's real exporter at `${receiver.url}/v1/traces`, then flush the exporter before reading:

```ts
import { otlpReceiver } from "@shivaedev/test-story/otlpReceiver.ts";

const receiver = yield* otlpReceiver();
yield* exportWork(`${receiver.url}/v1/traces`);
expect(receiver.spans).toContainEqual(expect.objectContaining({ name: "CountWords" }));
expect(receiver.requests.some(({ body }) => body.includes(Buffer.from("planted-secret")))).toBe(true);
```

`exportWork` is the kit's verb that runs application work and flushes its exporter. The receiver accepts OTLP/HTTP JSON and protobuf. `spans` flattens all exports into decoded trace and span IDs, parent span IDs, names, numeric OTLP kinds and status codes, attributes, events and links. Attributes retain OTLP key/value objects, including lossless decimal strings for integers; each span also has `resourceAttributes`. `requests` retains every request's unmodified `body` Buffer, parsed `headers`, original `rawHeaders` pairs and `path`. Search all body bytes when checking that a secret was not exported. Optional `path`, `status` (a number or attempt callback) and `answer` configure collector responses for failure stories.

For timeout stories, return `undefined` from the `status` callback to accept an export without sending response headers. Set `answer: null` to send headers without completing the response body.

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

Hooks and steps that wait for real workers can use `withLive(Effect.sleep(...))` or `withLive(eventually(...))` from `@shivaedev/effect-test/withLive.ts` and `@shivaedev/effect-test/eventually.ts`. Both work under the kit's live clock and a story's TestClock override. The wrapped work uses live time without advancing the story's virtual time; outside it, the selected clock still applies. Unwrapped `eventually` uses the active clock and advances TestClock between attempts.

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

After the engine has been created, a failing story test adds the story to its first error, as in the examples above:

- a short guide to reading the story, in a box;
- every line in order, traits marked `given`;
- `✗` after the last line, on the trait that refused, or alone when the test failed before the story told a line, and under it the spec line where the test stopped or that named the refusing trait;
- the engine's state from `inspect` as JSON, broken between its fields to fit 120 columns. State longer than 2,000 characters is written to `node_modules/.cache/test-story/` under the working directory, and the failure names the file;
- the command that reruns the test, with `-t` on a second line when one line would pass 120 columns.

The package wraps between words or JSON fields toward 120 columns and prints the story's own lines whole. An indivisible word, field or rerun command component can exceed that width. A passing test adds nothing. A typed failure with no message, such as an `after` hook's `NoBowls`, prints by its tag.

### Library package kits

A library package has an engine too: its own services or Layer under test. Keep its kit in `src/test-support/`, acquire the real services in `create` with their dependencies supplied by the kit's `layer`, and use real PostgreSQL wherever the package touches it. Traits seed that engine in domain words; verbs call the package's public API. The same division applies as for an application: the kit owns setup and wiring, and a spec names traits, calls verbs and checks results. Following the [root test guidance](https://github.com/ShivaeDev/platform/blob/main/AGENTS.md), reserve plain Vitest tests for pure functions with no engine behind them.

The [`backfill` kit](https://github.com/ShivaeDev/platform/blob/main/packages/effect-test-sql/src/test-support/migrationStory.ts) in `effect-test-sql` is a library example. Its `create` returns the package's `migrationSteps(migrations)` API, its worker Layer provides PostgreSQL, and `around: withIsolatedDatabase` isolates each story. The `oldSchema` and `existingContacts` traits put contacts with email addresses into the old schema; the `backfill` verb calls `steps.migrateToLatest`. Its [story](https://github.com/ShivaeDev/platform/blob/main/packages/effect-test-sql/src/server/migrationStory.spec.ts) proves that those existing addresses survive the migration into a new table. It runs only when `PLATFORM_EFFECT_TEST_SQL_TEST_DATABASE_URL` is configured; a skipped story proves nothing.

A fake belongs only at a true external boundary, wired in `create`; keep the package's own engine real. The [resume kit](https://github.com/ShivaeDev/platform/blob/main/packages/effect-contract/src/test-support/resumeStory.ts), for example, creates synthetic browser and native event sources while running the package's real `resumeSignal` API. Its [stories](https://github.com/ShivaeDev/platform/blob/main/packages/effect-contract/src/resume.dom.test.ts) exercise refresh on those events and listener cleanup. Those synthetic sources prove the package's response to events, not a physical browser or native application's event delivery.

### Whole-stack application kits

Keep one kit in the application’s `test-support/`. `effect-test` owns Vitest registration, worker Layer acquisition, the per-test Scope, cancellation and clock selection. `test-story` owns engine creation, staged traits, verbs and narration. The application owns database lifecycle, migrations, isolation, seeds, actual server/client wiring and screen interactions.

Set `runIf: hasPostgres` in the kit definition to gate all its stories once, where `hasPostgres` is a boolean such as `process.env.PLATFORM_EFFECT_SQL_TEST_DATABASE_URL !== undefined`. When false, `it`, `it.fails`, `it.only`, `it.skip`, `it.runIf` and `it.skipIf` all register skipped stories without acquiring the worker Layer or running `around`, creation, traits or bodies. A skipped `it.only` does not focus the file. When true or omitted, each variant keeps its usual Vitest behavior, including explicit skips and `fails` inverting a failure. Per-story conditions can skip more stories; they cannot enable a disabled kit. The engine, traits, verbs and services remain inferred from the definition.

The [order feature kit](https://github.com/ShivaeDev/platform/tree/main/packages/effect-react/src/test-support/order-example) runs the existing feature’s services, repository, contracts, JSON serialization and authentication middleware over a loopback HTTP listener. Its [stories](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/orderStory.dom.spec.tsx) test visible commits through a separate PostgreSQL pool, rollback of a rejected write without publication, cross-owner rejection, a native React action refreshing a list, and an editor retaining rejected input before a corrected save.

```ts
import { app, realPostgres } from "./test-support/application.ts";
import { aliceHasOrder } from "./test-support/traits.ts";

app.it("a save commits and a rejected write leaves storage intact", [realPostgres(), aliceHasOrder("paper")], function* ({ saveOrder, rejectOrder, storedOrderIs, changesAre }) {
  yield* saveOrder("paper", "Office chairs", 8);
  yield* storedOrderIs("paper", "Office chairs", 8);
  yield* rejectOrder("paper", -1);
  yield* storedOrderIs("paper", "Office chairs", 8);
  yield* changesAre(1);
});
```

The application’s worker Layer leases a uniquely named disposable database, opens native PgClient pools and runs `migratePostgres`. Multiple kits in the worker share the database; the last lease drops it after the pools close. The PostgreSQL trait checks that infrastructure and the declared policy; it does not start a database. The application validates its local disposable destination before database creation or reset and skips database stories without `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL`. Tests sharing that database run serially; parallelism belongs between workers or inside one story.

| Application mode | Reset policy | Transaction policy | Coverage |
| --- | --- | --- | --- |
| HTTP | Truncate application tables and restart identities before and after the story; retain the migration ledger. | Commands perform real commits. | RPC serialization/transport, independent persistence reads, React refresh and forms. |
| Local | Reset the baseline before and after the story. | Wrap creation, seeds and body in an outer Platform `transact`, then force rollback after success with a private sentinel. | Local repositories and services, transactional seeds and nested writes. |

The kit’s `around` implements that policy. HTTP requests run in separate fibers, so an outer test transaction cannot isolate their writes. Local rollback starts with Platform `transact`; putting it inside a native outer transaction violates transaction ownership. Catch only the wrapper’s private rollback sentinel, let other failures escape, and check independent storage before cleanup truncation so cleanup cannot hide an accidental commit.

Application-authored seed builders reuse application schemas, validate overrides, insert actual rows and return generated values. Traits retain aliases such as `"paper"` so specs avoid generated IDs. There is no shared factory or automatic relationship seeding.

React screen traits acquire roots in Scope and use a fresh native atom registry for each screen. Cleanup unmounts roots before disposing registries and servers. Screen verbs dispatch DOM events and use bounded observations of rendered output. Select a live clock once on an HTTP/DOM kit; keep TestClock for deterministic local stories. `runUntil` is for engines with a meaningful step hook, not HTTP or DOM polling. Creation forms can use the same pattern with the existing `useCreate` path.

The order example proves DOM and loopback HTTP behavior with bearer tokens. For cookie sessions, use the DOM host setup below. These fixtures do not prove browser networking, SSR, mobile or a deployed proxy. Native `RpcTest` can exercise handlers in faster local stories, but omits serialization and transport. Failure inspection is synchronous: keep redacted observed values in the engine instead of trying to query PostgreSQL inside `inspect`.

### DOM stories with cookie sessions

Install `happy-dom@20.14.6` as a dev dependency. Select the `@shivaedev/test-story/domEnvironment.config.ts` Vitest environment for DOM tests that start their host in the same process:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: fileURLToPath(import.meta.resolve("@shivaedev/test-story/domEnvironment.config.ts")),
  },
});
```

The environment keeps Node's global `fetch`, `Request`, `Response`, `Headers`, `AbortController` and `AbortSignal` for the in-process host. The separate `window` keeps happy-dom's constructors and cookie jar. Its asynchronous HTTP requests use Node fetch through the same `outbound` dispatcher, including XMLHttpRequest. Synchronous document HTTP requests are refused. The starter's [Vitest config](https://github.com/ShivaeDev/platform/blob/main/examples/starter/vitest.config.ts) selects this environment only for its DOM project while retaining the shared test projects. Use Vitest's standard forks or threads pool.

`domFetch(baseUrl)` from `@shivaedev/test-story/domFetch.ts` sets the document's location to the real HTTP host and returns a document fetch that resolves relative request strings against that URL. It translates Node `Request` and `Headers` inputs for happy-dom. Responses have happy-dom's status, headers and body methods; they are not instances of Node's global `Response`. The document keeps and sends cookies, including HttpOnly session cookies. Keep the default `same-origin` credentials policy for same-origin requests, and pass this fetch explicitly to browser clients, such as Better Auth's `fetchOptions.customFetchImpl`. The host continues to use global Node fetch without browser cookies.

Call it in the kit's `create` hook after starting the host:

```ts
import { createAuthClient } from "better-auth/react";
import { domFetch } from "@shivaedev/test-story/domFetch.ts";

const cookieApp = storyKit({
  around: withIsolatedDatabase,
  clock: "live",
  *create() {
    const { baseUrl } = yield* startHost();
    const fetch = domFetch(baseUrl);
    const client = createAuthClient({ baseURL: baseUrl, fetchOptions: { customFetchImpl: fetch } });
    return { client, fetch };
  },
  layer: postgres,
  name: "cookie auth",
  stages: ["account"],
  verbs: ({ client, fetch }, story) => authVerbs(client, fetch, story.tell),
});
```

`startHost`, `postgres` and `authVerbs` are application plumbing. The starter's [cookie application kit](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/test-support/cookieApp.ts) shows the full setup. Its Better Auth client signs up and signs in, and its verbs read `/api/auth/get-session` and post to `/api/auth/sign-out` through the DOM fetch. They do not copy cookies into request headers or use bearer tokens.

```ts
cookieApp.it("sign-up and sign-in keep their cookie sessions against the PostgreSQL host", [], function* ({ signUp, signIn, signOut, sessionIs }) {
  yield* signUp();
  yield* sessionIs("alice@starter.test");
  yield* signOut();
  yield* sessionIs(null);
  yield* signIn();
  yield* sessionIs("alice@starter.test");
  yield* signOut();
  yield* sessionIs(null);
});
```

This story proves Better Auth cookie sessions across real loopback HTTP requests from happy-dom with an in-process PostgreSQL host. It also reads sessions through Better Auth's client and checks the fetch response's status, headers and JSON body.

#### Social sign-in through an outbound provider

Happy-dom's detached window records a location change without loading the next document. `domNavigate(url = window.location.href)` from `@shivaedev/test-story/domNavigate.ts` performs that load: it follows HTTP redirects through the document transport, keeps cookies for each destination, sets the final location, writes the returned HTML and returns the happy-dom response. Call it after the sign-in client has set the provider location, and before checking the returned page. An unrouted external redirect fails with its hostname.

The starter's [social application kit](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/test-support/socialApp.ts) runs a fixture Better Auth host on real PostgreSQL, with a rendered sign-in button and a fake GitHub provider. Its `outbound` map routes both `github.com` and `api.github.com` to the fake's loopback origin. The fake's authorize endpoint returns the application's callback URL with the received state and a test code. The real callback exchanges that code and fetches the user against the fake, creates the account and session in PostgreSQL, and redirects to the signed-in page.

```ts
import { domNavigate } from "@shivaedev/test-story/domNavigate.ts";

const socialApp = storyKit({
  ...socialDefinition,
  outbound: { "github.com": fakeUrl, "api.github.com": fakeUrl },
  verbs: (engine, story) => ({
    signInWithGitHub: () => Effect.promise(async () => {
      story.tell("Alice clicks Sign in with GitHub");
      await engine.screen.click();
      await domNavigate();
    }),
    signedInPageIs: (email: string) => Effect.promise(async () => {
      expect(document.querySelector("h1")?.textContent).toBe(`Signed in as ${email}`);
      expect(await (await engine.fetch("/api/auth/get-session")).json()).toMatchObject({ user: { email } });
    }),
  }),
});

socialApp.it("a social sign-in returns with a cookie session", [], function* ({ signInWithGitHub, signedInPageIs }) {
  yield* signInWithGitHub();
  yield* signedInPageIs("alice@social.test");
});
```

`socialDefinition` starts the host and renders the screen with a Better Auth client whose `customFetchImpl` is `domFetch(baseUrl)`. The [story](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/server/socialSessions.dom.spec.ts) also checks the authorize, token and user requests at the fake, persisted PostgreSQL rows, and an HttpOnly session cookie read through a later document request. It does not copy cookies into request headers.

`domFetch` uses the current window and its cookie jar; it does not isolate multiple users. Run stories using that window serially, and let the application's cleanup end its sessions, restore the page location and close its host. Cookies follow hostnames, not listener ports, so a different loopback port alone does not isolate accounts.

### API by module

Import each module with the prefix `@shivaedev/test-story/`; there is no root entry.

| Module | Exports |
| --- | --- |
| `storyKit.ts` | `storyKit`, `Trait`, `RunUntilOptions`, `Story`, `RunHooks`, `StoryKitDefinition`, `Told`, `StoryBody`, `StoryTest`, `StoryIt`, `StoryKit` |
| `domFetch.ts` | `domFetch(baseUrl)` |
| `domNavigate.ts` | `domNavigate(url?)` |
| `genreTags.ts` | `genreTags(...kitNames)`, `GenreTag` |
| `domEnvironment.config.ts` | Default Vitest environment preserving Node host globals and happy-dom document transport |
| `otlpReceiver.ts` | `otlpReceiver(options?)`, `OtlpSpan`, `OtlpExport`, `OtlpReceiverOptions` |

### Install and limits

```sh
pnpm add --save-dev @shivaedev/test-story @effect/vitest@4.0.4 effect@4.0.4 vitest@5.0.3
```

`@effect/vitest`, `effect` and `vitest` are peers, so the application's own versions run the stories.

- The package runs inside Vitest. The story reaches the failure by rewriting the first error's message in Vitest's `onTestFailed` hook.
- Layer acquisition and engine creation failures precede that hook and carry no story appendix. A printed rerun command still needs a Vitest configuration that collects its file; the intentional `failingStories.ts` examples use the package's explicit fixture runner.
- A kit's `it` is created when the kit is defined, so a kit lives in a module that only Vitest test files import.
- `inspect` runs after the test has failed, so it reads the engine synchronously.
- The spec line under the `✗` is found by matching the spec's path in the failure's stack, or else in the call site of the last line the story told or the last `runUntil`. A failure raised inside an Effect that the spec does not call directly may have none.
- The package is built for ShivaeDev applications and may change without a deprecation period.
