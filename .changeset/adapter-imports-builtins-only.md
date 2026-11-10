---
"@shivaedev/quality": minor
---

### Added

- `effect/boundary` reports an `Effect.promise` or `Effect.tryPromise` bridge outside `adapters/` and `test-support/` whose callback calls a binding imported from an outside library: any import other than `effect`, `@effect/*`, `@shivaedev/*`, a workspace package, a relative path, a `#` alias or a Node builtin. Move that bridge into a module under `adapters/` that returns an Effect.

### Changed

- `effect/adapter-imports` reports only value imports of Node builtins outside `adapters/`. Using or exposing a library's types and calling a library function that returns a plain value need no adapter in core or client code, so applications get fewer findings from this rule and need no change for it.
- `effect/service-parameters` accepts a foreign resource passed between functions in any folder, and a default export implementing an imported foreign `Plugin` type is accepted in any folder.
- `effect/boundary`, `effect/service-parameters` and `effect/adapter-imports` describe `adapters/` as the one place for what Quality forbids elsewhere because a library requires it.
