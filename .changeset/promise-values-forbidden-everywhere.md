---
"@shivaedev/quality": minor
---

### Added

- `effect/boundary` reports, in its typed half, every call whose resolved signature an installed library declares and whose return type is `Promise`, `PromiseLike` or a union containing one, outside `adapters/`, `test-support/` and tests. It sees what the import-based bridge check could not: a received library value's method, such as `client.createQueue()`, called inside `Effect.tryPromise` or anywhere else, and a function that returns a library's Promise to its caller. A call that is awaited, chained with `.then` or bridged from an imported binding keeps its single finding from the local half. Declarations from `effect`, `@effect/*`, `@shivaedev/*`, workspace packages, TypeScript's default library and globals are not library Promises.
- Applications get new findings in CI and in `quality lint --full` where their core code calls a library that returns a Promise. Move each call into a module under `adapters/` that returns an Effect, for example `Effect.tryPromise(() => auth.api.signUpEmail({ body }))` behind a `signUpEmail(auth, account)` adapter, and record the rest as existing debt with `quality baseline write --rule effect/boundary`.
