# @shivaedev/test-story

Tests that read like short English stories and run the real engine. A spec names its setup in domain words, acts through the application's verbs and lets the engine run, so a human sees at a glance what is tested and an agent writes fewer lines to test more of the stack.

## Why you want this

When agents write most of the code, test files grow into hundreds of lines nobody reads. Each test rebuilds its setup by hand, mocks whatever was too much work to build, and hides what it actually checks. A story test holds only what is specific to it:

```ts
bakery.it("steps until the condition holds", [ovenIsLit(), hasDough(3)], function* ({ oven }) {
  yield* oven.bakesEverything();
  expect(oven.loaves()).toBe(3);
  expect(oven.minutes()).toBe(3);
});
```

That is a whole test. `bakery.it` comes from the bakery's story kit. The list holds its traits, `ovenIsLit()` and `hasDough(3)`, which are written once and shared by every spec. `oven.bakesEverything()` performs the baking action until the dough is gone; `oven.loaves()` and `oven.minutes()` read separate observations. The spec states both expectations. Every story runs the whole engine, so each test also checks the parts its author never thought to mock, and because a spec reads as English, a sloppy test stands out in review.

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
         at src/test-support/failingStories.ts:12:34

The bakery when the test failed:
{"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":1,"minute":1,"orders":[],"ovenLit":true,"overfired":false,
"smoking":false,"starter":false}

Rerun: vitest run src/test-support/failingStories.ts -t "Bakery Story: marks where an assertion stopped the story"
```

The first line is the assertion's own message. The box under it tells a reader who has never seen the package how to read what follows. Then comes the story: the two traits the test named, the line the bakery told as it baked, and a `✗` where the test stopped, with the spec line it stopped at. Last come the bakery's whole state at that moment and the command that reruns the test, so the failure alone is enough to find the cause.

## Using it

Before writing or reviewing application stories, follow the [story-testing skill](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/story-testing/SKILL.md), shipped by `@shivaedev/skills`. It owns the rules for observable evidence, boundary-driven setup, verbs and readouts, assertions, jobs, framework gaps, faked preconditions, database isolation and focused runs. The examples below explain this package's API; framework fixtures exercise this package's responsibilities, rather than prescribe application scenarios.

### How to think about it

An application has an **engine**: the real thing a test drives, such as a bakery simulation, a game store or a service with its database. A **story** is one test's run of a fresh engine. It starts from **traits**, sentences of setup in domain words that each change the engine, and goes on through **verbs**, the entry points a user or caller reaches, such as `baker.kneads(2)` or `oven.bakesEverything()`. The engine may also run on its own, one **step** at a time, until something the test waits for holds. Every trait tells a line, and verbs and steps tell what they do, so the story is both the plan the test gave and the trace of what happened, in order.

Every story belongs to a **genre**, the kind of engine it runs. The kit names each of its tests after its genre, such as `Bakery Story: steps until the condition holds`, so a report shows which engine a test runs and one run can pick the bakery's stories and leave the others.

The package runs on Effect and Vitest, but an engine needs neither: every hook, trait and test body may be a plain function. Use a generator function to yield Effects when a hook needs a service or fails with a typed error; the kit runs it, so no definition needs `Effect.gen`. Creation, stage `after` hooks and traits may also be plain functions that return an Effect directly. The kit runs that Effect in the story's Scope, with the services from its layer.

The work splits into three layers, and each is written by a different hand at a different time:

1. **Once per engine**, a story kit in `test-support/` says how to create the engine, which services it needs, and how to seed, step and show it.
2. **Once per feature**, traits and verbs in the kit name that feature in domain words.
3. **In every test**, a spec tells a story with the kit's `it` and checks what a user would see.

### The verb shape every kit follows

A verb performs one action on the real engine or reads one observation. An action may return its real response, such as an HTTP response; it does not orchestrate a scenario and package the measurements for the spec. A readout reports what happened without deciding whether it was correct. The spec shows each action in order and states every expectation.

Acquire real services in `create` or a trait inside the story's per-test Scope, with dependencies provided by `layer`. Keep those services on the engine so verbs use the same running instance; scoped cleanup releases them after the story. Do not build and tear down services inside each verb. When closing a service is the action under test, expose that action separately from acquisition and observation.

| Shape to avoid | What to do instead |
| --- | --- |
| A verb runs a whole scenario and returns the measurements the spec asserts. | Give each action and observation its own verb; let the spec compose them and compare the observations. |
| A verb hard-codes the expected outcome or hides assertions. | Return the real response or observation, and put expected values and all assertions in the spec. |
| A verb does two jobs and returns both results. | Split the jobs into two verbs and show both calls in the spec. |
| A verb silently does nothing when its target is missing, such as `button?.click()`. | Fail with a message naming the missing target, then perform the action only once the target exists. |
| An engine default hides what the story declares, such as a lit oven, signed-in user or authorization header. | Start with a neutral engine and name the precondition in a trait or pass the input explicitly in the action. |

The bakery below starts with a cold oven and no dough. Its traits declare heat and dough, its baking action returns no report, and its readouts expose loaves and elapsed minutes separately. `runUntil` waits for that one engine action to complete; it does not replace a spec's sequence of actions.

### 1. Once per engine: the story kit

`storyKit(definition)` from `@shivaedev/test-story/server/storyKit.ts` turns one definition into the kit. Every type, the engine's, the stages', the verbs' and the services', is inferred from it.

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
      bakesEverything: (maxSteps?: number): Effect.Effect<void, BurntLoaf> =>
        story.runUntil((current) => current.dough === 0, { maxSteps }),
      loaves: () => state.loaves,
      minutes: () => state.minute,
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
| `clock` | Optional. `"test"` by default, `"live"` for real time, or a UTC `DateTime` to start TestClock at that instant. A story’s `options.clock` takes precedence. |
| `create()` | A fresh engine. Every story starts from a new one. |
| `layer` | Optional. The worker Effect layer that provides the services hooks, traits and test bodies use. Per-test Scope is already available to creation, staged and run hooks, traits and bodies. A hook that needs a service the layer does not provide does not compile, and neither does a test whose traits or body need one. |
| `stages` | The order traits are applied in. A trait names its stage, and one that names a stage the kit does not declare does not compile. |
| `after` | Optional. A hook per stage that runs once that stage's traits are applied, even when no trait names the stage, so a value it derives is ready before a later stage reads it. Its typed failure fails the test. |
| `run` | Optional. What `story.runUntil` needs: `step(engine, tell)` advances the engine once and tells what happened, `maxSteps` caps one run, `failed(engine)` returns a sentence when the engine is in a state it cannot recover from, and `diagnose(engine)` says why it has not finished. |
| `inspect` | Optional. The part of the engine a failure prints. Without it, the failure prints the whole engine. |
| `verbs(engine, story)` | One action or one observation per verb. A verb that waits for a stepped engine returns the Effect from `story.runUntil`; the spec reads observations and asserts separately. |

Every test of the kit is named `Bakery Story: <its name>`, so `vitest run -t "Bakery Story: "` runs only the bakery's stories with no setup. A project that splits runs by Vitest tags can also tag them:

```ts
import { genreTags } from "@shivaedev/test-story/server/genreTags.ts";
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

`routeOutbound(routes)` from `@shivaedev/test-story/server/routeOutbound.ts` installs the same routing in the current Effect Scope. Acquire a `fakeHttpService` in `create`, then yield `routeOutbound({ "api.example.com": api.url })` so the fake listener and its routing belong to that story. The starter's social sign-in story exercises this path through both document navigation and host-side requests.

Routing uses the global dispatcher that Node's built-in `fetch` already uses. The kit's `outbound` option installs routing before `around`, creation, traits and the body, stays active during scoped cleanup, and restores the previous dispatcher after each story, including a failing story. Stories within one worker must run one at a time because that dispatcher is shared; parallelism belongs between workers or inside one story. The DOM environment uses the same routing for host-side Node fetch and document requests, including redirect destinations. It refuses external hosts even when the kit omits `outbound`.

#### Asserting on application traces

Start an in-process host in `create` or a stage's `after` hook, such as `after: { deployment }`. Creation and every `after` hook run without the ambient parent span, so an Effect HTTP handler that captures its context does not inherit a span placed around the story. Their scoped teardown and finalizers retain that detached context. The tracer, services and per-story Scope remain available. Traits, verbs, engine steps and assertions in the story body keep the span supplied by `around`.

This lets an application's story assert that a request starts its own trace: a request without trace headers starts a root trace, and a request with `traceparent` continues that trace. Host startup and cleanup do not join the story's trace.

A kit can collect spans with a native in-memory tracer, or start a fake OTLP receiver and point the application's exporter at it. Expose collection, exporter flush and any bounded wait as separate verbs. Assert only after the request span has ended. This small in-memory kit uses Effect's Web Request handler as its host:

```ts
import { Effect, Tracer } from "effect";
import { HttpEffect, HttpServerResponse } from "effect/http";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const app = storyKit({
  around: (effect) => effect.pipe(Effect.withSpan("story")),
  *create() {
    const spans: Tracer.NativeSpan[] = [];
    const tracer = Tracer.make({
      span: (options) => {
        const span = new Tracer.NativeSpan(options);
        spans.push(span);
        return span;
      },
    });
    const context = yield* Effect.context<never>().pipe(Effect.withTracer(tracer));
    const handler = HttpEffect.toWebHandlerWith(context)(Effect.succeed(HttpServerResponse.text("ok")));
    return { handler, spans };
  },
  name: "traced application",
  stages: ["ready"],
  verbs: ({ handler, spans }) => ({
    request: (headers: HeadersInit = {}) => Effect.promise(async () => {
      const response = await handler(new Request("http://app.test/", { headers }));
      return response.text();
    }),
    requestSpan: () => {
      const span = spans.filter((span) => span.kind === "server").at(-1);
      if (span === undefined) throw new Error("The request exported no server span");
      return span;
    },
  }),
});

app.it("a request is its own root trace", [], function* ({ request, requestSpan }) {
  const storySpan = yield* Effect.currentSpan;
  expect(yield* request()).toBe("ok");
  const span = requestSpan();
  expect(span.parent._tag).toBe("None");
  expect(span.traceId).not.toBe(storySpan.traceId);
  expect(span.status._tag).toBe("Ended");
});

app.it("a request continues its supplied trace", [], function* ({ request, requestSpan }) {
  yield* request({ traceparent: "00-1234567890abcdef1234567890abcdef-1234567890abcdef-01" });
  const span = requestSpan();
  expect(span.traceId).toBe("1234567890abcdef1234567890abcdef");
  expect(span.parent).toMatchObject({ value: { spanId: "1234567890abcdef" } });
});
```

Detachment only removes the incoming parent: spans that application startup explicitly creates still follow native Effect semantics.

#### Forwarding requests to a host

Use `forwardingProxy` from `@shivaedev/test-story/server/forwardingProxy.ts` in the kit's scoped `create` or `after` hook after starting the host under test:

```ts
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";

const proxy = yield* forwardingProxy(upstream, {
  localAddress: "::1",
  forwardedHops: ["203.0.113.9", "2001:db8::1"],
  headers: {
    host: "internal.test",
    "x-forwarded-host": "app.example",
    "x-forwarded-proto": "https",
  },
});
```

Point story requests at `proxy.url`. The proxy listens on IPv4 and IPv6 loopback on the same allocated port, forwards the request's method, path, query, body and headers to `upstream`, and returns the host's status, headers and body. It appends the connecting caller's address to `x-forwarded-for`, preserving any existing chain. Set `forwardedHops` to append those addresses in order instead of the caller, so a client chain of `spoofed` with hops `visitor` and `edge` becomes `spoofed, visitor, edge`. The optional `headers` map overrides incoming and generated headers, including `x-forwarded-for` when the story needs a fixed chain.

Set `localAddress` to choose the source socket address of the proxy's connection to the host. The upstream must accept that address family; for a hostname, the proxy resolves the matching family. Use `127.0.0.1` or `::1` for portable loopback stories. An unavailable local address fails acquisition with a message naming it. The proxy returns 502 if it cannot connect to the host. Both listeners close with the story's Scope.

#### Reading OTLP exports

Use `otlpReceiver` from `@shivaedev/test-story/server/otlpReceiver.ts` in a kit's scoped `create` hook. It listens on an allocated loopback port and closes with the story scope. Point the application's real exporter at `${receiver.url}/v1/traces`, then flush the exporter before reading:

```ts
app.it("exports the work span", [], function* ({ runWork, disposeRuntime, spans, requests }) {
  yield* runWork();
  yield* disposeRuntime();
  expect(spans()).toContainEqual(expect.objectContaining({ name: "CountWords" }));
  expect(requests().some(({ body }) => body.includes(Buffer.from("planted-secret")))).toBe(true);
});
```

Here `app` is the application's kit. Its `create` acquires the receiver and the real exporter pointed at that receiver, `runWork` performs the traced operation, `disposeRuntime` disposes the exporter's runtime and flushes pending spans, and `spans` and `requests` read the receiver's observations. Each action is visible in the spec. The receiver accepts OTLP/HTTP JSON and protobuf. `spans` flattens all exports into decoded trace and span IDs, parent span IDs, names, numeric OTLP kinds and status codes, attributes, events and links. Attributes retain OTLP key/value objects, including lossless decimal strings for integers; each span also has `resourceAttributes`. `requests` retains every request's unmodified `body` Buffer, parsed `headers`, original `rawHeaders` pairs and `path`. Search all body bytes when checking that a secret was not exported. Optional `path`, `status` (a number or attempt callback) and `answer` configure collector responses for failure stories.

For timeout stories, return `undefined` from the `status` callback to accept an export without sending response headers. Set `answer: null` to send headers without completing the response body.

#### Faking an outbound HTTP API

Use `fakeHttpService` from `@shivaedev/test-story/server/fakeHttpService.ts` in a kit's scoped `create` hook. Like the OTLP receiver, it listens on an allocated loopback port and closes with the scope. Routes have names for controls, a method (default `GET`), and a path whose `:segments` become decoded `request.params`. A reply receives the request and returns a JSON `body` (or a `Uint8Array`/Buffer sent as raw bytes), optional `status` (default 200), and optional response `headers`.

```ts
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

const api = yield* fakeHttpService({
  guard: ({ headers }) => headers.authorization === "Bearer story-key",
  routes: {
    user: { path: "/users/:id", reply: ({ params }) => ({ body: { id: params.id } }) },
    items: { path: "/items", pages: [["paper", "ink"], ["pens"]] },
  },
});
```

Point the application's real HTTP client at `api.url`, or use the kit's `outbound` map to route its external hostname there. A service-wide `guard` returns a boolean; a missing or wrong credential gets 401 before holds or scripted replies are consumed. Each route can also declare a `guard(request)`; both guards must accept the request before holds, arrival scripts or faults run. A route's guard applies only to that route, so an installation token check can sit beside public routes. Omit the guard for a public fake. Unmatched paths and methods get 404.

In `verbs`, bind `api.narrate(story.tell)` to tell received requests, replies, rejections and hold controls through the story. An optional `tell` callback can also be supplied at acquisition. The service keeps request headers and bytes in its log; narration of normal requests includes only method, path and status.

```ts
api.narrate(story.tell);
yield* api.failOnce("user", { status: 502, body: { error: "try again" } });
const paused = yield* api.hold("user");
const pending = yield* Effect.forkChild(application.loadUser("alice"));
yield* paused.waiting;
yield* paused.release;
const user = yield* Fiber.join(pending);
```

`application.loadUser` is the application's real client call. `failOnce` affects the next authorized matching request to that named route, then the route answers normally. `hold` pauses that route until `release`; `waiting` completes when a request reaches the hold, so a story needs no polling to know when to release it. Other routes still answer. Effects that wait for HTTP should use a live-clock kit.

Use the controls through kit verbs after acquiring the service. `replyOnce(route, reply)` scripts the next authorized reply, including raw bytes or `chunks`, a synchronous or asynchronous iterable of strings and byte arrays. Set `headers["content-type"]` to the story's media type; the default is JSON. Chunks are written in iteration order as they become available, so an async iterable can wait between pieces.

```ts
yield* api.replyOnce("download", {
  body: Uint8Array.from([0, 255, 128]),
  headers: { "content-type": "application/octet-stream" },
});
const stalled = yield* api.stall("download");
const pending = yield* Effect.forkChild(application.download());
yield* stalled.waiting;
yield* stalled.release;
const bytes = yield* Fiber.join(pending);
```

`stall(route)` sends the reply's status and headers, then pauses its body. Its `waiting` effect completes at that pause. Its `release` lets the body continue; a client that gives up also stops waiting on the server. Like a hold, a stall remains installed for matching requests until released. Holds pause before headers. `releaseOnArrival(heldRoute, arrivingRoute)` releases the current hold when an authorized request reaches the named route; script it before that arrival. Rejected requests do not trigger release.

`fault(route, fault)` acts on an arrived request in the required phase. `{ kind: "status", reply: { status: 503, body: { error: "unavailable" } } }` replaces a held reply before headers. `{ kind: "drop" }` drops a connection before headers. `{ kind: "reset" }` terminates a reply after headers, including after body chunks have arrived. Wait for the hold, stall or client observation before injecting the fault. A fault fails with guidance when no request is in the required phase; it does not queue a failure for a future call. `failOnce` continues to queue a status reply for the next request.

`stall(route, scope)`, `fault(route, fault, scope)`, `failOnce(route, reply, scope)` and `replyOnce(route, reply, scope)` accept an optional `{ params: { number: "7" } }`. Every supplied parameter must equal the decoded request parameter. Other resources on the same named route answer normally and do not consume the scoped reply. A scoped stall still returns `waiting` and `release`.

Use `scriptFault(route, fault, options)` to install a fault for future authorized matching requests. It returns a control with a narrated `lift` effect. The default strikes once before the route's reply runs; `{ repeat: true }` keeps it installed until lifted. Status faults can repeat too.

```ts
const outage = yield* api.scriptFault("pull", { kind: "drop" }, {
  params: { number: "7" },
  repeat: true,
});
yield* application.loadPull("7");
yield* outage.lift;

yield* api.scriptFault("comment", {
  kind: "status",
  reply: { status: 503, body: { error: "try later" } },
}, { params: { number: "7" }, phase: "after" });
yield* application.postComment("7", "Ready for review");
```

With `phase: "after"`, the route's reply function runs and applies its effects before the fault strikes. A status fault replaces the reply, a drop closes before headers, and a reset sends the route's status and headers then closes its unfinished body. The comment therefore exists even though the client sees a failure. This lets an application story check retry behavior after a side effect. The default `phase: "before"` skips the reply function when the fault strikes.

All controls validate route names and narrate through the service's story sink. Closing the scope closes active connections and releases holds, stalls and arrival scripts.

A `pages` route accepts a one-based `?page=` query and returns `{ items, next }`, with `next: null` on the last page. No query means page 1; a page past the end returns an empty list; a non-positive or non-integer page gets 400. `api.requests` reads a snapshot of the request log, including rejected and held requests, with `method`, `path` (including query), raw `body` Buffer, `headers`, `params` and `query`.

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
         refused at src/test-support/failingStories.ts:15:57
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

### Pinning time

Pass a UTC `DateTime` as the story's `clock` option to pin time before its wrapper, creation, traits and hooks run. Code that uses `Clock` or `DateTime.now` reads that instant. Advance it explicitly with native `TestClock.adjust`:

```ts
import { DateTime } from "effect";
import * as TestClock from "effect/testing/TestClock";

app.it("shows the worker's date", [], function* ({ click, settle, text }) {
  yield* click("button");
  yield* settle();
  expect(text("#worker")).toBe("Worker: since Oct 17");
  yield* TestClock.adjust("1 day");
  yield* click("button");
  yield* settle();
  expect(text("#worker")).toBe("Worker: since Oct 18");
}, { clock: DateTime.makeUnsafe("2026-10-17T12:34:56.000Z") });
```

Acquire hosts, workers and screens in per-story Scope so they inherit the story's Clock. An independent runtime or native HTTP handler must capture the Effect Context at acquisition, as with `HttpEffect.toWebHandlerWith(context)` or `Effect.runPromiseWith(context)`. Worker-scoped kit `layer` acquisition stays outside the per-story clock; shared services acquired there do not acquire a new clock for each story. Direct JavaScript wall-time reads are not replaced. Formatting stays with the application, including its locale and time zone.

The [clock application stories](src/server/fixedClock.dom.spec.ts) run loopback HTTP, a queued worker that writes a timestamp to a file, and a DOM screen with its own Effect runner. They check exact timestamps and rendered dates, advancing time, and a live story without the option. A live-clock kit still runs on real time when a story omits the override.

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

A library package has an engine too: its own services or Layer under test. Keep its kit in `src/test-support/`, acquire the real services in `create` or a trait inside the story's per-test Scope, with their dependencies supplied by the kit's `layer`, and use real PostgreSQL wherever the package touches it. Traits seed that engine in domain words; each verb calls one action on the package's public API or reads one observation from that same engine. Verbs never create a fresh service just to run a scenario and return its measurements. The same division applies as for an application: the kit owns setup and wiring, and a spec names traits, shows every action through verbs and states each expectation. Following the [root test guidance](https://github.com/ShivaeDev/platform/blob/main/AGENTS.md), reserve plain Vitest tests for pure functions with no engine behind them.

The [`backfill` kit](https://github.com/ShivaeDev/platform/blob/main/packages/effect-test-sql/src/test-support/migrationStory.ts) in `effect-test-sql` is a library example. Its `create` returns the package's `migrationSteps(migrations)` API, its worker Layer provides PostgreSQL, and `around: withIsolatedDatabase` isolates each story. The `oldSchema` and `existingContacts` traits put contacts with email addresses into the old schema; the `backfill` verb calls `steps.migrateToLatest`. Its [story](https://github.com/ShivaeDev/platform/blob/main/packages/effect-test-sql/src/server/migrationStory.spec.ts) proves that those existing addresses survive the migration into a new table. It runs only when `PLATFORM_EFFECT_TEST_SQL_TEST_DATABASE_URL` is configured; a skipped story proves nothing.

A fake belongs only at a true external boundary, wired in `create`; keep the package's own engine real. The [resume kit](https://github.com/ShivaeDev/platform/blob/main/packages/effect-contract/src/test-support/resumeStory.ts), for example, creates synthetic browser and native event sources while running the package's real `resumeSignal` API.

### Whole-stack application kits

Keep one kit in the application’s `test-support/`. `effect-test` owns Vitest registration, worker Layer acquisition, the per-test Scope, cancellation and clock selection. `test-story` owns engine creation, staged traits, verbs and narration. The application owns database lifecycle, migrations, isolation, seeds, actual server/client wiring and screen interactions.

Set `runIf: hasPostgres` in the kit definition to gate all its stories once, where `hasPostgres` is a boolean such as `process.env.PLATFORM_EFFECT_SQL_TEST_DATABASE_URL !== undefined`. When false, `it`, `it.fails`, `it.only`, `it.skip`, `it.runIf` and `it.skipIf` all register skipped stories without acquiring the worker Layer or running `around`, creation, traits or bodies. A skipped `it.only` does not focus the file. When true or omitted, each variant keeps its usual Vitest behavior, including explicit skips and `fails` inverting a failure. Per-story conditions can skip more stories; they cannot enable a disabled kit. The engine, traits, verbs and services remain inferred from the definition.

The [order feature kit](https://github.com/ShivaeDev/platform/tree/main/packages/effect-react/src/test-support/order-example) is an example: it runs the feature’s services, repository, contracts, JSON serialization and authentication middleware over a loopback HTTP listener with bearer tokens.

For full-app stories, use `around: withIsolatedDatabase` from `@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts` with a PostgreSQL test layer prepared from the application's migrations. Each story gets a database cloned from that template, and HTTP and worker pools commit into the same clone. The clone is dropped after scoped hosts and pools close. The starter's [application kit](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/test-support/application.ts) uses this isolation path.

For repository-level tests on a migrated template, `withTestTransaction` from `@shivaedev/effect-test-sql/server/withTestTransaction.ts` provides rollback isolation when all work uses its transaction connection. See the [database test helpers](https://github.com/ShivaeDev/platform/blob/main/packages/effect-test-sql/README.md) for template preparation and both wrappers.

React screen traits acquire roots in Scope and use a fresh native atom registry for each screen. Cleanup unmounts roots before disposing registries and servers. Screen verbs dispatch DOM events and use bounded observations of rendered output. Select a live clock once on an HTTP/DOM kit; keep TestClock for deterministic local stories. `runUntil` is for engines with a meaningful step hook, not HTTP or DOM polling. Creation forms can use the same pattern with the existing `useCreate` path.

For cookie sessions, use the DOM host setup below. Native `RpcTest` can exercise handlers in faster local stories, but omits serialization and transport. Failure inspection is synchronous: keep redacted observed values in the engine instead of trying to query PostgreSQL inside `inspect`.

### DOM stories with cookie sessions

Install `happy-dom@20.14.6` as a dev dependency. Select the `@shivaedev/test-story/server/domEnvironment.config.ts` Vitest environment for DOM tests that start their host in the same process:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: fileURLToPath(import.meta.resolve("@shivaedev/test-story/server/domEnvironment.config.ts")),
  },
});
```

The environment keeps Node's global `fetch`, `Request`, `Response`, `Headers`, `AbortController` and `AbortSignal` for the in-process host. The separate `window` keeps happy-dom's constructors and cookie jar. Its asynchronous HTTP requests use Node fetch through the same `outbound` dispatcher, including XMLHttpRequest. Synchronous document HTTP requests are refused. The starter's [Vitest config](https://github.com/ShivaeDev/platform/blob/main/examples/starter/vitest.config.ts) selects this environment only for its DOM project while retaining the shared test projects. Use Vitest's standard forks or threads pool.

`domFetch(baseUrl)` from `@shivaedev/test-story/server/domFetch.ts` sets the document's location to the real HTTP host and returns a document fetch that resolves relative request strings against that URL. It translates Node `Request` and `Headers` inputs for happy-dom. Responses have happy-dom's status, headers and body methods; they are not instances of Node's global `Response`. The document keeps and sends cookies, including HttpOnly session cookies. Keep the default `same-origin` credentials policy for same-origin requests, and pass this fetch explicitly to browser clients, such as Better Auth's `fetchOptions.customFetchImpl`. The host continues to use global Node fetch without browser cookies.

Call it in the kit's `create` hook after starting the host:

```ts
import { createAuthClient } from "better-auth/react";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";

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

`startHost`, `postgres` and `authVerbs` are application plumbing. Actions in `authVerbs` perform requests, and readouts return response data for assertions in the spec. A sign-in story drives its real sign-in flow; feature stories start from a faked signed-in precondition as described in the shared skill.

#### Seeding a signed-in precondition

`seedCookies(cookies)` from `@shivaedev/test-story/server/seedCookies.ts` returns an Effect that seeds the current happy-dom window's cookie container, including HttpOnly cookies. Call `domFetch(baseUrl)` first so the document and requests use the same origin. Each cookie has `name` and `value`, with optional `domain`, `path`, `httpOnly`, `secure`, `sameSite` (`Lax`, `Strict` or `None`) and `expires` (Unix seconds). Better Auth's test-utils login cookies fit this shape directly.

```ts
import { signedInUser } from "@shivaedev/platform/server/better-auth/testing.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";

const { cookies } = yield* Effect.promise(() => signedInUser(testAuth, {
  email: "alice@example.test",
  name: "Alice",
}));
yield* seedCookies(cookies);
```

`testAuth` is a test-only auth instance configured with Platform's `authTestUtils()` and the real host's database, secret and cookie policy. The seeded session travels on the document's fetch and stays hidden from `document.cookie` when HttpOnly. Use `http://localhost:<port>` for local DOM hosts with secure cookies: happy-dom matches secure cookies on localhost, but not on `http://127.0.0.1`. The listener can still bind to `127.0.0.1`.

#### Social sign-in through an outbound provider

Happy-dom's detached window records a location change without loading the next document. `domNavigate(url = window.location.href)` from `@shivaedev/test-story/server/domNavigate.ts` performs that load: it follows HTTP redirects through the document transport, keeps cookies for each destination, sets the final location, writes the returned HTML and returns the happy-dom response. Call it after the sign-in client has set the provider location, and before checking the returned page. An unrouted external redirect fails with its hostname.

The starter's [social application kit](https://github.com/ShivaeDev/platform/blob/main/examples/starter/src/test-support/socialApp.ts) runs a fixture Better Auth host on real PostgreSQL, with a rendered sign-in button and a fake GitHub provider. Its `create` hook acquires the provider and uses scoped `routeOutbound` routing for both `github.com` and `api.github.com`. The fake's authorize endpoint returns the application's callback URL with the received state and a test code. The real callback exchanges that code and fetches the user against the fake, creates the account and session in PostgreSQL, and redirects to the signed-in page.

The kit renders a Better Auth client whose `customFetchImpl` is `domFetch(baseUrl)`. The story calls `clickGitHubSignIn`, `settle` and `followRedirect` separately, then reads the heading, cookie and session. The screen driver settles on the screen's request state and reads the heading from the current document after navigation. The provider uses `fakeHttpService`. The authorize, token and user requests at the fake and a later session response provide evidence across the provider and application boundaries. The kit does not copy cookies into request headers.

```ts
socialApp.it("a social sign-in returns with a cookie session", [], function* ({ clickGitHubSignIn, settle, followRedirect, heading, cookie, session }) {
  yield* clickGitHubSignIn();
  yield* settle();
  const response = yield* followRedirect();
  expect(response.status).toBe(200);
  expect(heading()).toBe("Signed in as alice@social.test");
  expect(cookie()).not.toContain("session_token");
  expect(yield* session()).toMatchObject({ user: { email: "alice@social.test" } });
});
```

`domFetch` uses the current window and its cookie jar; it does not isolate multiple users. Run stories using that window serially, and let the application's cleanup end its sessions, restore the page location and close its host. Cookies follow hostnames, not listener ports, so a different loopback port alone does not isolate accounts.

### Driving a screen

`screenDriver(options)` supplies DOM verbs and readouts for a kit's `verbs` hook. Give it the mounted `root` (or a getter for a root that navigation replaces), the story's `tell`, and a `pending()` function that reads the application's own request or atom state. `settle()` waits until that signal is false; repeated identical renders never count as completion. The application must keep the signal true until its resulting screen work is ready to render.

```ts
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";

verbs: ({ view, requests }, story) => screenDriver({
  root: view.container,
  pending: () => requests.pending,
  tell: story.tell,
})
```

`click(selector)`, `enter(selector, value)` and `submit(selector = "form")` return Effects. Selectors identify exactly one descendant of the root; missing or ambiguous controls fail. Hidden targets and targets inside hidden ancestors refuse actions and readouts. Text entry focuses an input or textarea and dispatches input and change events. Disabled controls refuse clicks and entry, inert ancestors also prevent form submission, and read-only fields refuse entry. Actions do not wait for settlement, so a story can release a held request before calling `settle()`.

`text(selector?)` returns rendered text from the selected element or the whole root. `value(selector)` returns the current input or textarea value. Both narrate what they read through `tell` and leave assertions to the spec. Entry narration omits the supplied value.

`click`, `enter`, `submit`, `text` and `value` also accept a `ScreenTarget` object such as `{ role: "button", name: "Save" }` or `{ role: "textbox", name: /email/i }`. The role and computed accessible name must match exactly when strings are used; regular expressions match the name. Like Testing Library's role queries, these targets exclude hidden elements, including `aria-hidden` ancestors. Missing or ambiguous targets fail with the requested role, name and the visible candidates on screen. Narration names the role and name instead of a selector.

`accessible(selector)` returns `{ name, role }` computed by `dom-accessibility-api`, including native roles and label references that take precedence over `aria-label`. It narrates the readout and uses the same single rendered target checks as other readouts. Assert on this result when checking a control's accessible name; reading its raw attributes does not compute that name. This DOM computation does not inspect a browser's accessibility tree or prove speech from a screen reader.

`accessible(element)` uses the same computation on an `Element` the kit already holds and tells no story line.

For React, pass `act: async (action) => { await act(action); }` using React's `act`. The adapter wraps each action and flushes renderer work before checking the pending signal, including while waiting for an asynchronous response. The [React driver stories](https://github.com/ShivaeDev/platform/blob/main/packages/effect-react/src/screenDriver.dom.spec.tsx) cover a native pending atom, a rendered response and a controlled field without React warnings. The driver itself has no renderer dependency.

Settlement has a live-time limit of 3 seconds, configurable with the driver's `timeoutMs` or per call with `settle({ timeoutMs })`, and fails with the current screen text and advice when that limit expires. Use the existing DOM environment and scoped `routeOutbound` routing to reach `fakeHttpService`; the driver does not install another transport. The [screen stories](src/server/screenSignals.dom.spec.ts) hold a real HTTP response across repeated renders and sign in by filling and submitting a form against a fake identity provider. These fixtures prove DOM interactions and loopback HTTP, not a browser or a production authentication system.

### API by module

Import each module with the prefix `@shivaedev/test-story/server/`; there is no root entry.

| Module | Exports |
| --- | --- |
| `storyKit.ts` | `storyKit`, `Trait`, `RunUntilOptions`, `Story`, `RunHooks`, `StoryKitDefinition`, `Told`, `StoryBody`, `StoryTest`, `StoryIt`, `StoryKit` |
| `domFetch.ts` | `domFetch(baseUrl)` |
| `seedCookies.ts` | `seedCookies(cookies)`, `DomCookie` |
| `routeOutbound.ts` | `routeOutbound(routes)` |
| `screenDriver.ts` | `screenDriver(options)`, `ScreenDriverOptions`, `ScreenDriver`, `ScreenTarget` |
| `domNavigate.ts` | `domNavigate(url?)` |
| `genreTags.ts` | `genreTags(...kitNames)`, `GenreTag` |
| `domEnvironment.config.ts` | Default Vitest environment preserving Node host globals and happy-dom document transport |
| `fakeHttpService.ts` | `fakeHttpService(options)`, `FakeHttpRoute`, `FakeHttpRequest`, `FakeHttpReply`, `FakeHttpFault`, `FakeHttpHold`, `FakeHttpScope`, `FakeHttpScriptOptions`, `FakeHttpScript`, `FakeHttpServiceOptions` |
| `forwardingProxy.ts` | `forwardingProxy(upstream, options?)`, `ForwardingProxyOptions` |
| `otlpReceiver.ts` | `otlpReceiver(options?)`, `OtlpSpan`, `OtlpExport`, `OtlpReceiverOptions` |

### Install and limits

```sh
pnpm add --save-dev @shivaedev/test-story @effect/vitest@4.0.4 effect@4.0.4 vitest@5.0.3
```

`@effect/vitest`, `effect` and `vitest` are peers, so the application's own versions run the stories.

- The package runs inside Vitest. The story reaches the failure by rewriting the first error's message in Vitest's `onTestFailed` hook.
- Layer acquisition and engine creation failures precede that hook and carry no story appendix. A printed rerun command still needs a Vitest configuration that collects its file.
- A kit's `it` is created when the kit is defined, so a kit lives in a module that only Vitest test files import.
- `inspect` runs after the test has failed, so it reads the engine synchronously.
- The spec line under the `✗` is found by matching the spec's path in the failure's stack, or else in the call site of the last line the story told or the last `runUntil`. A failure raised inside an Effect that the spec does not call directly may have none.
- The package is built for ShivaeDev applications and may change without a deprecation period.
