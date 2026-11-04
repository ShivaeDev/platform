---
"@shivaedev/local-postgres": minor
"@shivaedev/pr-watch": minor
"@shivaedev/releases": minor
---

### Breaking

- `@shivaedev/local-postgres`: `assertLocalDatabase` and `clientConnection` return synchronous Effect `Result` values. Use Result combinators for synchronous handling or wrap their return values with `Effect.fromResult` before yielding or entering an Effect pipeline. Validation and password decoding keep their typed errors.
- `@shivaedev/pr-watch`: `optionsFor` returns a synchronous Effect `Result`. Use Result combinators for synchronous argument handling or wrap the return value with `Effect.fromResult` before yielding or entering an Effect pipeline.
- `@shivaedev/releases`: `parseChangeset` and `parseBody` return synchronous Effect `Result` values. Use Result combinators for pure parsing or wrap their return values with `Effect.fromResult` before yielding or entering an Effect pipeline. Malformed quoted scalars keep their original non-enumerable error cause.
