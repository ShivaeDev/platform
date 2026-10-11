### Added

- `makeEffectIt` fixture testers accept Effect-returning bodies as well as generators, including table cases and tester variants. Both forms retain harness, service, clock and per-test Scope behavior.
- Export `EffectTestBody<THarness, TProvided, A>` from `types.ts` to describe both fixture body forms.
