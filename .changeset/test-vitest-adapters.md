---
"@shivaedev/test": minor
"@shivaedev/quality": patch
---

### Breaking

- `@shivaedev/test`: Import `makeEffectIt` from `@shivaedev/test/adapters/makeEffectIt.ts` and `it` from `@shivaedev/test/adapters/it.ts`. Their former module paths are removed. The internal `runEffectTest` bridge also moves from `internal/` to `adapters/`; `buildTestLayer` is now private to the fixture adapter. Replace external calls to it with native `Layer.buildWithScope`.

- `@shivaedev/test`: Import `AnyTestLayer` from `@shivaedev/test/types.ts`; its former `anyTestLayer.ts` module is removed.

### Changed

- `@shivaedev/test`: Ordinary and table tests use the same Vitest context path and share generator and Effect body normalization.
- `@shivaedev/quality`: Quality recognizes the adapter module paths when checking test declarations and reports the current `it` import in body-normalization diagnostics.
