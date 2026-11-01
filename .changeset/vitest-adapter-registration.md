---
"@shivaedev/test": minor
---

### Breaking

- Move the Vitest entry modules into adapters. Change imports of `@shivaedev/test/it.ts`, `@shivaedev/test/makeEffectIt.ts`, `@shivaedev/test/anyTestLayer.ts` and `@shivaedev/test/internal/runEffectTest.ts` to the corresponding `@shivaedev/test/adapters/` paths. `buildTestLayer(layer)` now reads Scope from the Effect environment; replace `buildTestLayer(layer, scope)` with `buildTestLayer(layer).pipe(Effect.provideService(Scope.Scope, scope))` when supplying an existing scope.

### Changed

- Ordinary and table fixture tests share context handling and body normalization while retaining file Layer and per-test resource lifetimes.
