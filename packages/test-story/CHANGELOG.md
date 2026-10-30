# Changelog

## 0.25.0 - 2026-10-30

### Added

- Export every engine module through the package's existing `.ts` wildcard, including modules under `internal/` in `test` and `vitest-rerun` and `server/internal/` in `test-story` and `test-sql`, so downstream kits can reuse them directly. Importing the rerun worker leaves test execution to its direct launch.

### Changed

- Generated applications import React test helpers from their existing `@shivaedev/test-story` development dependency.

### Fixed

- Every story in the DOM environment starts with no cookies, `localStorage` or `sessionStorage`, so a story no longer passes or fails because of what an earlier story in the same file stored.

### Breaking

- Remove the legacy engine-first `storyKit` overload. Replace `storyKit<Engine, "ready", Verbs>({ ... })` with `storyKit({ ... })`; annotate the return type of `create` when an explicit engine shape is needed. Stages, verbs and services are inferred from the definition.
- Remove `fakeHttpService.failOnce` and `replyOnce`. Replace either `api.failOnce(route, reply, scope)` or `api.replyOnce(route, reply, scope)` with `api.scriptFault(route, { kind: "status", reply }, scope)`. The default still consumes only the next authorized matching request. The result now contains a `lift` effect, and narration uses the existing scripted-fault wording.
- Move the React test helpers to `@shivaedev/test-story/client/react.ts`. Replace imports from `@shivaedev/react/client/testing.ts` with this path for `render`, `eventually`, `captureReactWarnings`, `expectNoReactWarnings` and their types. Add `@shivaedev/test-story` as a development dependency and install its React helpers' optional peers `react`, `react-dom` and `@effect/atom-react` when using them. React no longer brings `@shivaedev/test` into applications as a runtime dependency.
- Kits declaring `outbound` and direct `routeOutbound(routes)` scopes now refuse unrouted external Node fetch requests and fail at scope close, even when application code catches the fetch error. Add hostnames to the outbound map, or explicitly opt into network access with `outboundPassthrough: true` on the kit or `{ passthrough: true }` as the second argument to `routeOutbound`. Loopback requests remain allowed; the DOM environment still refuses unrouted external hosts.
- Thrown fake HTTP handlers now close the connection and fail the story at scope close with the request and a description of the thrown value. To simulate an upstream error, return an error status or script an HTTP fault instead of throwing.

## 0.24.0 - 2026-10-30

### Added

- Scope screen-driver verbs and readouts with `within(container)`, and mount named member screens with independent cookie sessions, atom registries and scoped roots through `memberScreens`.
- Create password-credential test users with Identity's `passwordUser` helper for real email sign-in stories.

### Changed

- Work Board file edits refresh authorized contract queries over Platform's shared WebSocket, including the Claude plugin's overview. Unrelated document reads retain their values.
- Forwarding proxy fixtures can disconnect and resume real client traffic at the same address.
- Automatic contract live connections expose a `paused` atom; resuming reconciles their mounted queries. Bindings can supply a `resumeWindow` for embedded browser lifecycle events.
- Live status notifications use the registry's asynchronous scheduler, so mounting a query during React rendering does not update another component.
- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

### Breaking

- Work Board removes its `subscribe` RPC. Consumers bind its contract queries with Platform's default WebSocket client instead of consuming Board-specific change hints.
- `WorkspaceConfig.indexing` supplies a progress snapshot Effect. Replace indexing Stream overrides with an Effect that reads current progress.

## 0.23.0 - 2026-10-29

### Added

- Forwarding proxy fixtures relay WebSocket upgrades, including the same origin and trusted proxy headers as HTTP requests. Existing proxy URLs also work for socket clients.

### Breaking

- Screen text readouts concatenate visible HTML text nodes without CSS text transforms or layout line breaks. Update text assertions to match DOM text content; hidden descendants remain omitted.
- Contract clients use Effect RPC over a shared WebSocket by default. Replace `httpClient`, `transformClient` and `serialization` client options with a native `protocol` Layer for custom transports. Node clients can supply upgrade `headers` and a `webSocketConstructor` Layer; browsers use their session cookie automatically.
- Mounting a bound query subscribes before its first authorized read; unmounting releases its subscription. Use `live: false` when binding an ordinary client without subscriptions. Query preparation alone no longer opens a change stream.
- Hosts serve live subscriptions on the WebSocket upgrade at the RPC path. Move HTTP `$changes` consumers to Effect RPC's socket protocol; the POST route serves ordinary RPC only. Configure development proxies to forward WebSocket upgrades.
- React session boundaries bind shared sockets to the identified session, so replacing an account upgrades with its current cookie. They also ask the auth owner to recheck when the live socket closes. Keep `recheck` safe to call after a network interruption; the auth owner still decides whether the session ends.

## 0.22.0 - 2026-10-28

### Added

- Compose independent feature kits with `storyKit({ name, extends: [first, second] })`, inferring their engines, traits, verbs and layer services in one per-test Scope with ordered creation and cleanup. Duplicate verb names, trait stage names and engine fields are rejected at the type level.
- The application host provides Effect's native Crypto service during preflight and deferred construction as well as in application handlers, so commands can generate secure invite codes without ambient randomness.
- Story kits provide native TestCrypto with a fresh seed of 0 for each story, making generated invite codes reproducible. The application’s @effect/platform-node peer supplies its digest implementation.
- Ambient-randomness findings name Effect's Crypto service for secure values and Random for non-secure values.
- `outcomes` checks Effect readouts in row order with one labelled Vitest equality diff, preserving readout error and requirement types and pointing story failures at the spec call.

## 0.21.1 - 2026-10-27

### Fixed

- Cancel timers armed in the DOM environment before removing its globals, so Better Auth's delayed session cleanup cannot access a removed `window`.

## 0.21.0 - 2026-10-27

### Added

- `@shivaedev/test-story` depends on `@shivaedev/test-sql`, so an application's one test dependency brings `@shivaedev/test` and `@shivaedev/test-sql`. It forwards `@effect/sql-pg`, which `@shivaedev/test-sql` needs, as an optional peer.

## 0.20.1 - 2026-10-26

### Fixed

- Skip disabled external stylesheets and module scripts during DOM navigation without logging unsupported-file errors or fetching the assets.

## 0.20.0 - 2026-10-25

### Added

- Screen drivers can act on and read screens without a `pending` option. Only `settle()` requires the signal; without it, settlement fails immediately with the typed `MissingScreenPending` error. Drivers that supply `pending` keep `settle()` typed as `Effect<void>`.

## 0.19.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.19.0 - 2026-10-25

### Added

- Build fake HTTP fault replies from the answered request and the service’s captured Effect clock, through `scriptFault`, `fault`, `failOnce` and `replyOnce`.
- Read completed response statuses, pending requests and unanswered connections from the fake HTTP request log.
- Hold a parameter scope or only its first matching request, and release a scoped hold on another route’s arrival.
- Match trailing `:name*` route parameters across one or more percent-decoded path segments.

## 0.18.3 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.18.2 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.18.1 - 2026-10-24

### Changed

- Align published dependency and peer pins and the generated starter with React and React DOM 19.3.1, TanStack Router 1.170.45, Better Auth 1.7.10, happy-dom 21.0.3 and Vitest 5.0.5. The starter also uses pg-boss dashboard 1.12.1.

## 0.18.0 - 2026-10-21

### Breaking

- Test-story's peers are exactly Vitest 5.0.4 and happy-dom 21.0.1. Consumers pin `vitest` to 5.0.4 and, when they run DOM stories, `happy-dom` to 21.0.1; happy-dom remains optional for applications without DOM stories.

## 0.17.0 - 2026-10-19

### Added

- Quality's `manifests/exports-shape` rule checks exports at the package root and in workspace members by default. Modules use one file-preserving TypeScript wildcard with matching source, types and runtime targets; root entries, exact non-code assets, package metadata and null blocks are allowed.

### Breaking

- Quality's Biome preset moves from `@shivaedev/quality/biome` to `@shivaedev/quality/biome/preset.json`. Change the `extends` entry in your Biome config to the new path; the old alias is removed. TypeScript preset paths are unchanged.
- `@shivaedev/effect-pg-boss`, `@shivaedev/effect-test-sql`, `@shivaedev/local-postgres` and `@shivaedev/test-story` expose server modules at their file paths. Add `/server/` after the package name in imports, for example `@shivaedev/test-story/server/storyKit.ts`. The shortened paths are removed; internal server modules remain blocked.
- Work Board moves `@shivaedev/work-board/client/client.ts` to `@shivaedev/work-board/browserClient.ts`; change browser-client imports to that file path. `@shivaedev/work-board/client/document/View.ts` is removed: consume document queries with your own renderer, or use the bundled Board browser UI. The client bundle stays private and the old export overrides are removed.

## 0.16.0 - 2026-10-19

### Added

- `screenDriver.find(target, { timeout }?)` waits for a unique element by selector or role and accessible name, narrates the lookup, and returns the element with the actions' candidate diagnostics when no unique target appears.

## 0.15.0 - 2026-10-19

### Added

- Scope `fakeHttpService` stalls, immediate faults and one-shot replies by decoded path parameters with `FakeHttpScope`.
- Script future status, drop and reset faults with `scriptFault` and `FakeHttpScriptOptions`, optionally repeat until the returned `FakeHttpScript.lift` control or strike after the route's reply applies its effects.
- Declare per-route guards alongside the service guard; rejected requests receive 401 before holds, arrival scripts or faults are consumed.

## 0.14.0 - 2026-10-19

### Added

- `screenDriver` actions and text/value readouts accept `ScreenTarget` selectors or `{ role, name }` targets, with exact string or regular-expression accessible names, hidden-element exclusion, candidate diagnostics and role/name narration.
- `screenDriver.accessible(element)` computes an existing element's accessible name and role without narration; `accessible(selector)` keeps its narrated readout.

## 0.13.0 - 2026-10-19

### Added

- `ForwardingProxyOptions.localAddress` selects the proxy's source socket address and rejects unavailable addresses during acquisition. `ForwardingProxyOptions.forwardedHops` appends visitor and edge hops after the client's `x-forwarded-for` chain instead of the caller address; fixed `headers` still override the generated chain.

## 0.12.0 - 2026-10-18

### Added

- Fake HTTP services expose `stall`, `replyOnce`, `releaseOnArrival` and `fault` controls for body stalls, raw byte and iterable chunk replies, automatic hold release on route arrival, and faults injected into arrived requests or replies in flight. `FakeHttpReply.chunks` accepts string or byte iterables, and the exported `FakeHttpFault` describes status, pre-header drop and mid-body reset faults. Controls validate route names, narrate through the story and clean up with its scope.

## 0.11.1 - 2026-10-18

### Changed

- Release with updated workspace dependencies.

## 0.11.0 - 2026-10-18

### Added

- Pass a UTC `DateTime` to the existing `clock` option to pin a story or Effect fixture before its per-test setup runs. The exported `EffectClock` type now accepts `DateTime.Utc` alongside `"test"` and `"live"`. Hosts, workers and screens acquired with the story's Effect Context share native `Clock` / `TestClock`, including explicit `TestClock.adjust` advances; application code using `Clock` or `DateTime.now` needs no changes.

## 0.10.0 - 2026-10-18

### Added

- Platform exports `authTestUtils(options?)` and `signedInUser(auth, fields)` from `server/better-auth/testing.ts` for typed Better Auth test utilities and signed-in story preconditions with user fields and roles, without OAuth or password hashing.
- Test-story exports `seedCookies(cookies)` and `DomCookie` from `seedCookies.ts` to seed happy-dom's cookie container, including HttpOnly session cookies accepted by a real HTTP host.

## 0.9.0 - 2026-10-18

### Added

- `forwardingProxy(upstream, options?)` and `ForwardingProxyOptions` from `@shivaedev/test-story/forwardingProxy.ts` provide a scoped loopback proxy for host stories. It forwards requests and responses, appends the caller to `x-forwarded-for`, and applies the story's configured headers.

## 0.8.0 - 2026-10-18

### Added

- `screenDriver(options).accessible(selector)` returns and narrates an element's computed accessible name and role, including label references that take precedence over `aria-label`.
- Export `screenDriver(options)`, `ScreenDriverOptions` and `ScreenDriver` from `screenDriver.ts`: narrated DOM clicks, text entry, form submission and screen readouts, with settlement driven by the app's pending signal and an optional renderer `act` adapter. Screens use the existing DOM transport to reach fake HTTP services, including identity providers.
- Screen drivers accept a root getter for document navigation and a per-call `settle({ timeoutMs })` limit.
- Export `routeOutbound(routes)` from `routeOutbound.ts` to scope outbound routing alongside a story's fake HTTP service.
- Screen actions and readouts reject hidden targets and targets inside hidden ancestors; form submission also refuses inert ancestors.
- Accept `stages: []` in `storyKit` definitions for engines initialized entirely in `create`, preserving inferred engine and verb types with no available trait stages.

## 0.7.1 - 2026-10-18

### Fixed

- Publish against `@shivaedev/effect-test` 0.6.0 so framework consumers share the current test runner.

## 0.7.0 - 2026-10-18

### Added

- `fakeHttpService` serves a scoped loopback API for story kits, with named path-param routes, an auth guard, JSON pages, one-shot replies, request holds and an ordered request log. Bind `narrate(story.tell)` to tell requests and controls in the story.

### Changed

- Point application story authors to the shared `story-testing` skill and align README guidance with observable results, explicit assertions and database isolation.

## 0.6.0 - 2026-10-18

### Added

- Let the OTLP receiver's status callback return `undefined` to withhold response headers, or set `answer: null` to send headers without completing the body.

## 0.5.0 - 2026-10-17

### Added

- Export `otlpReceiver` from `otlpReceiver.ts`: a scoped local OTLP/HTTP JSON and protobuf receiver with decoded span readouts and raw export headers and body bytes. Export `OtlpSpan`, `OtlpExport` and `OtlpReceiverOptions` for story kit authors.
- Gate every story in a kit with the inferred definition's `runIf` boolean option. A false condition skips every `it` variant before setup, including `fails` and `only`, while preserving per-story skips and conditions.

### Fixed

- Run every stage's `after` hook without the story's parent span, including its scoped teardown and finalizers, so hosts booted after deployment can start independent request traces while story verbs keep their story span.

## 0.4.1 - 2026-10-17

### Fixed

- Run engine creation without the story's parent span, so in-process HTTP handlers capture an independent context: requests without trace headers start root traces, and `traceparent` continues the supplied trace. Traits, steps and the story body retain their story span.

## 0.4.0 - 2026-10-17

### Added

- `domNavigate(url?: string | URL): Promise<Response>` follows document redirects, keeps cookies and loads the final HTML for DOM stories, including social sign-in through an outbound OAuth fake.

### Fixed

- Keep Node fetch for in-process hosts and route the DOM document's asynchronous HTTP requests through the same outbound fakes. Unrouted external hosts fail DOM stories with the hostname, even when application code catches the request error.
- Pass the `domFetch` result explicitly to browser clients (for Better Auth, `fetchOptions.customFetchImpl`); global fetch now belongs to the host. Happy-dom remains an optional peer for the DOM environment.

## 0.3.0 - 2026-10-17

### Added

- `@shivaedev/test-story/domEnvironment.config.ts` exports a Vitest environment with Node's global `Request`, `Response`, `Headers` and abort classes for an in-process HTTP host, while happy-dom fetch keeps the client's cookie jar. Fetch accepts native headers and request inputs. Better Auth sign-up, sign-in, session reads and sign-out are tested against the starter's real PostgreSQL host, including its auth client and client response inspection.
- `domFetch(baseUrl)` from `@shivaedev/test-story/domFetch.ts` sets the happy-dom page origin to its host and resolves relative fetch requests.
- `storyKit` accepts `outbound: Readonly<Record<string, string>>` to route selected hostnames from Node's built-in `fetch` to fake server origins for each story, then restore the previous dispatcher after success or failure. Other hosts pass through unchanged.

## 0.2.1 - 2026-10-16

### Fixed

- Let `create`, stage `after` hooks and traits return an Effect directly, with inferred engine types, checked service requirements and the story's Scope, alongside generators and synchronous functions.

## 0.2.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/vitest` 4.0.4 and Vitest 5 alongside it.

## 0.1.1 - 2026-10-12

### Added

- Story creation, staged hooks, run hooks, traits and bodies can use the runner’s per-test `Scope` without a worker Layer supplying it. Unrelated services still require a matching Layer.
- `StoryKitDefinition.around` wraps creation, staged seeding and the body while leaving worker acquisition outside the wrapper.
- `StoryKitDefinition.clock` selects the kit’s default clock; per-story clock options take precedence.

### Changed

- Verify `skip`, `skipIf` and `runIf` in an isolated runner, with passing suite assertions for registration and setup/body non-execution instead of skipped suite tests.
- Clarify roadmap ownership, failure-narration lifetime and output limits; keep the existing README and `docs/` publication shape.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.1.0 - 2026-10-06

### Added

- `@shivaedev/test-story/storyKit.ts` exports `storyKit(definition)`, one story kit per engine. The definition names the engine, says how to `create` a fresh one, the optional `layer` that provides its services, the `stages` traits are applied in with an optional `after` hook per stage, the optional `run` hooks (`step`, `maxSteps`, `failed`, `diagnose`), an optional `inspect` and the `verbs` a test acts through. Every hook may be a plain function or a generator function that yields Effects, and every type is inferred from the definition. A hook, trait or test body that needs a service the layer does not provide does not compile.
- The kit returns `trait`, `traits` and its own `it(name, traits, body, options)`, built on `@shivaedev/effect-test`. Each test starts a fresh engine, seeds the traits stage by stage and runs the body with the verbs and the `story`: its `engine`, `lines`, `tell(line)` and `runUntil(condition, { maxSteps })`. `it.fails`, `it.only`, `it.skip`, `it.runIf` and `it.skipIf` work as in Vitest.
- Every test of a kit is named after its genre, such as `Bakery Story: steps until the condition holds`, so `-t "Bakery Story: "` picks one engine's stories. `@shivaedev/test-story/genreTags.ts` exports `genreTags(...kitNames)`, which declares a Vitest tag per kit, such as `bakery-story`, for `--tags-filter`. A kit tags its tests only with a genre the config declares, and runs them untagged and silently otherwise.
- A trait that throws, fails or dies refuses the setup with `the trait "<line>" refused to set up the <engine>: <cause>`, a `help:` line and the thrown value as the error's `cause`. An interrupted trait stays interrupted.
- `story.runUntil` steps the engine until the condition holds, dies with what `run.failed` reports even when the condition also holds, and after `maxSteps` steps dies with `run.diagnose`. The typed failures of the run hooks and the condition stay in its error channel.
- A failed story prints under its test's first error: a short guide to reading it, every line in order, a mark where it stopped or on the trait that refused with the spec line there, the engine's state from `inspect` as JSON (written to `node_modules/.cache/test-story/` when longer than 2,000 characters), and the command that reruns the test. The package breaks what it prints at 120 columns, except the story's own lines. A thrown string, plain object or tagged error prints by its content.
