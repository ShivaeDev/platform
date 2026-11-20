---
"@shivaedev/quality": minor
"@shivaedev/github": patch
"@shivaedev/heavy-lock": patch
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/quality`: `effect/unsafe-calls` reports bare calls of Effect's `…Unsafe` functions in core code, which throw on bad input or act at once outside an Effect: functions imported from `effect` or `@effect/*` such as `DateTime.makeUnsafe` or `Queue.offerUnsafe`, such a function passed as a callback, and member calls on a value such as `reactivity.registerUnsafe(keys, changed)`. Applications get a finding for each one outside `adapters/`, `test-support/`, tests and tool configs. Fix it with the safe counterpart the finding names (`DateTime.make` and `Duration.fromInput` return an Option, a `Duration` constructor builds a fixed value, `Queue.offer` is an Effect, `Stream.callback` turns a callback into a stream), or move a real synchronous side effect into an `Effect.sync`, `Effect.try` or `Effect.suspend` thunk, which also accepts a callback written inside it. Record what remains with `quality baseline write --rule effect/unsafe-calls`.

### Fixed

- `@shivaedev/github`: a rate-limit reset header past the last date a `DateTime` holds no longer fails the request with a defect. The client records no budget from it, and a spent-budget refusal backs off as if no reset had been sent.
- `@shivaedev/heavy-lock`: a waiter prints that the holder has held the lock since an unknown time when the holder's recorded start lies past the last date a `DateTime` holds, instead of failing.

### Breaking

- `@shivaedev/test-story`: `recordedSignals()` from `server/recordedSignals.ts` returns an Effect that builds the record, and `fakeHttpSignals` from `server/fakeHttpSignals.ts` is an Effect instead of a function: yield both. `screenMutations` from `server/adapters/screenMutations.ts` takes the `Queue` it offers each change to instead of a callback.
