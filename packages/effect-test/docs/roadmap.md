# Roadmap

This roadmap owns the test runner, its public contracts and its package tests. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed fixtures, application adoption and host or deployment validation. The same status is recorded in one place.

## Built

- [x] `it.effect` and `it.live` accept generator bodies and Effect-returning bodies over the upstream testers. Tests cover the controlled and live clocks, table cases, expected failure, conditional skipping and plain Vitest tests.
- [x] `makeEffectIt` supplies the Layer's services, an inferred harness and Vitest's test context to the generator. Tests cover wrapper entry, harness values and table cases.
- [x] Default TestClock, factory live-clock selection and per-test overrides in either direction. Acquisition-time tests distinguish the worker Layer's live clock from the harness and body's test clock.
- [x] `Layer.empty` runs without a placeholder service. Compiler tests reject a service the empty Layer does not provide and retain harness, service and table-case types.
- [x] `eventually` retries typed failures on both clock paths. Tests count initial attempts and retries, preserve the final typed failure, reject thrown assertion retries, accept assertions captured with `Effect.try`, and preserve interruption.
- [x] Packed-consumer compiler fixtures exercise the published runner modules and retained harness types.

## Next

- [ ] Add direct acquisition-count and finalizer assertions for worker Layer reuse and release, including acquisition failure.
- [ ] Assert per-test scope cleanup and wrapper ordering around harness construction as well as the body.
- [ ] Cover a timer fiber started during worker acquisition and a fixture that explicitly supplies its own Clock, so the clock boundary has direct regression evidence.
- [ ] Cover the runner's TestConsole environment, tester variants and `buildTestLayer` with assertions dedicated to the behavior this package adds.

## Open questions

- Should composed application fixtures gain any API here, or remain framework examples and downstream helpers? The runner keeps the composition points small; new fixture APIs need a repeated job that the existing Layer, harness and wrapper cannot express.
- Which lifecycle and clock properties need local regression tests, and which should rely on the upstream Vitest and Effect contracts? The next items identify the gaps in this package's own evidence without changing its public API.
