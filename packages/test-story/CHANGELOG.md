# Changelog

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
