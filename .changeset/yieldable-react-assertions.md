---
"@shivaedev/effect-react": minor
"@shivaedev/effect-test": minor
---

### Added

- `@shivaedev/effect-test` readiness retries accept `timeout` and `wait` options. A timeout preserves the final typed failure; a custom wait lets adapters settle observable work through the same retry engine.

### Breaking

- `@shivaedev/effect-react/client/testing.ts` now returns an Effect from `eventually(assert)`. Replace `yield* Effect.promise(() => eventually(assert))` with `yield* eventually(assert)` in stories and Effect tests, or replace `await eventually(assert)` with `await Effect.runPromise(eventually(assert))` in async tests. Assertions wait inside React `act` in live time, including under TestClock. Timeout errors include elapsed milliseconds and the last assertion message, with the assertion error as their `cause`.
