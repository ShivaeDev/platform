# Roadmap

This file owns the story kit's implementation, next work and open questions. The
[framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md)
owns composed application features and host-level validation. Those roadmaps link
to each other rather than repeating a completion checklist.

## Built

- [x] `storyKit(definition)`: one Effect kit per engine, with every type and the services its layer provides inferred from its hooks. Plain engines plug in with plain functions.
- [x] Traits seeded stage by stage, with a hook after each stage, and refusal of an impossible setup.
- [x] The kit's own `it`, built on `@shivaedev/effect-test`, which hands the body the verbs and the story and names every test after the kit's genre. Vitest tags per genre are opt-in through `genreTags(...kitNames)` in the Vitest config.
- [x] `story.runUntil(condition)`: steps the engine until the condition holds, stops on what `run.failed` reports, and stops after a step budget with a diagnosis, keeping every hook's typed failure in its error channel.
- [x] A failed test prints a short guide, its story, where it stopped with the spec line there, and the engine's state, inline or in a file under `node_modules/.cache/test-story/`, broken at 120 columns.
- [x] `domEnvironment` keeps Node fetch classes for an in-process host and happy-dom fetch for the client; `domFetch(baseUrl)` connects the window to that host, with a starter story proving Better Auth sign-up, sign-in, session reads and sign-out on PostgreSQL through cookies.
- [x] `outbound` routes selected hostnames to fake server origins through Node fetch and the DOM document transport. [Node stories](../src/server/outbound.spec.ts) cover request preservation and routing cleanup; [DOM stories](../src/server/documentTransport.dom.spec.ts) cover redirects, cookies and XMLHttpRequest.
- [x] `domNavigate` loads a document through that transport, sets the final location and writes the returned HTML while leaving the response readable, covered by the [document transport stories](../src/server/documentTransport.dom.spec.ts).
- [x] Creation, traits and stage `after` hooks can return Effects directly, with services from the kit's Layer and resources released in the story's Scope, covered by [Effect hook stories](../src/server/effectHooks.spec.ts).
- [x] Kit hooks and steps support a live clock and a per-story TestClock override. [Live-time stories](../src/server/liveTime.spec.ts) cover polling real workers with `withLive` without advancing virtual token expiry.
- [x] Host requests start independent root traces or continue the trace context in request headers, while traits and steps retain the story span, covered by [host tracing stories](../src/server/hostTracing.spec.ts).

## Next

- [ ] Move the Work Fleet engine's hand-written story DSL onto the kit and let what it needs decide the next hook.

## Open questions

- A long story prints in full. Should a story of thousands of lines print its traits and its last lines, and write the rest to a file the way a large engine state is written?
- `inspect` runs synchronously when the test has failed. An engine whose state lives behind an Effect service cannot be read then. Is that worth an Effect inspect, captured when the failure happens?
