# Changelog

## 0.10.1 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.10.0 - 2026-10-27

### Breaking

- Rename `@shivaedev/effect-test` to `@shivaedev/test`. Change dependency declarations and imports from `@shivaedev/effect-test/...` to `@shivaedev/test/...`; module paths inside the package are unchanged.

## 0.9.0 - 2026-10-25

### Added

- `@shivaedev/effect-test` readiness retries accept `timeout` and `wait` options. A timeout preserves the final typed failure; a custom wait lets adapters settle observable work through the same retry engine.

### Breaking

- `@shivaedev/effect-react/client/testing.ts` now returns an Effect from `eventually(assert)`. Replace `yield* Effect.promise(() => eventually(assert))` with `yield* eventually(assert)` in stories and Effect tests, or replace `await eventually(assert)` with `await Effect.runPromise(eventually(assert))` in async tests. Assertions wait inside React `act` in live time, including under TestClock. Timeout errors include elapsed milliseconds and the last assertion message, with the assertion error as their `cause`.

## 0.8.1 - 2026-10-25

### Fixed

- Close shared test service Layers before their test file completes so database cleanup finishes before Vitest starts terminating the fork.

## 0.8.0 - 2026-10-25

### Breaking

- Move `@shivaedev/effect-test/vitest.ts` to `@shivaedev/effect-test/makeEffectIt.ts`. Change imports to `@shivaedev/effect-test/makeEffectIt.ts`; the exported `makeEffectIt` function is unchanged.

## 0.7.2 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.7.1 - 2026-10-18

### Fixed

- Wait for an interrupted test's Scope to close after its Vitest timeout, so application workers and database pools finish teardown before the next test starts. Keep the timeout as the test failure without leaking the interrupted program's rejection as an uncaught error.

## 0.7.0 - 2026-10-18

### Added

- Pass a UTC `DateTime` to the existing `clock` option to pin a story or Effect fixture before its per-test setup runs. The exported `EffectClock` type now accepts `DateTime.Utc` alongside `"test"` and `"live"`. Hosts, workers and screens acquired with the story's Effect Context share native `Clock` / `TestClock`, including explicit `TestClock.adjust` advances; application code using `Clock` or `DateTime.now` needs no changes.

## 0.6.0 - 2026-10-18

### Breaking

- Modules are named in camelCase: `any-test-layer.ts` becomes `anyTestLayer.ts`.

## 0.5.0 - 2026-10-16

### Added

- `withLive(effect)` from `@shivaedev/effect-test/withLive.ts` runs sleeps and readiness polls in live time under either TestClock or the live clock, without advancing the surrounding TestClock.

## 0.4.0 - 2026-10-13

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/vitest` 4.0.4 alongside it, which requires Vitest 5.

## 0.3.2 - 2026-10-12

### Added

- `makeEffectIt` fixture testers accept Effect-returning bodies as well as generators, including table cases and tester variants. Both forms retain harness, service, clock and per-test Scope behavior.
- Export `EffectTestBody<THarness, TProvided, A>` from `types.ts` to describe both fixture body forms.
- `makeEffectIt` harnesses, wrappers, generator bodies and table bodies can use the per-test `Scope` already supplied by the runner. The worker Context and inferred Layer services stay unchanged; unrelated services still require a matching Layer.

### Changed

- Name descriptive generic type parameters with a `T` prefix, preserving test runner types and behavior.
- Verify conditional skipping in an isolated Vitest fixture, with passing suite assertions for registration and body non-execution instead of a skipped suite test.
- Explain the runner's purpose, service and test lifetimes, clock choices and typed readiness polling in the README, agent north star and package docs; publish `docs/` with the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.3.1 - 2026-10-06

### Fixed

- `makeEffectIt` takes a Layer that provides nothing, such as `Layer.empty`, so a suite whose tests need no services passes no placeholder service. A test body that yields a service such a Layer does not provide still does not type-check.
- `@shivaedev/effect-test/any-test-layer.ts` exports `buildTestLayer(layer, scope)`, which builds any test Layer, `Layer.empty` included, into the services it provides.

## 0.3.0 - 2026-10-05

### Added

- `@shivaedev/effect-test/it.ts` exports `it`: the `it` of `@effect/vitest`, whose `effect` and `live` testers also take a generator function and run it with `Effect.gen`, so a test reads `it.effect("loads the item", function* () { … })`. They take a function that returns an Effect as well, as `@effect/vitest`'s testers do, so a file switches its import without rewriting other tests. Each tester supports `each`, `fails`, `only`, `runIf`, `skip` and `skipIf`, runs the body in a Scope, and types the yielded values, failures and requirements: a body that needs a service the test does not provide does not type-check. `effect` installs the test services, such as TestClock; `live` uses the live ones. The types are `EffectIt`, `EffectItTest` and `EffectItTester` in `@shivaedev/effect-test/types.ts`.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/effect-test`: `@shivaedev/effect-test/eventually.ts` (`EventuallyOptions`, `eventually`), `@shivaedev/effect-test/types.ts` (`EffectClock`, `EffectTest`, `EffectTester`, `EffectTestOptions`, `MakeEffectItOptions`, `MakeEffectItResult`), `@shivaedev/effect-test/vitest.ts` (`makeEffectIt`)

## 0.1.3 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.1.2 - 2026-09-26

### Fixed

- Make `eventually` retry only typed failures under TestClock, matching the live
  clock. Defects and interruption propagate without retrying.

### Changed

- Document the live worker-Layer clock and the scope of per-test clock overrides.

## 0.1.1 - 2026-09-04

### Changed

- Require Effect 4.0.0-rc.112, so applications tracking the current release
  candidate install without unmet peer warnings.

## 0.1.0 - 2026-08-30

### Added

- Add `makeEffectIt` for generator Effect tests on a worker-scoped Layer, with
  TestClock by default, an optional `around` hook, and a Clock-aware
  `eventually` helper.
