---
"@shivaedev/quality": minor
---

### Changed

- `effect/adapter-imports` reports only value imports of Node builtins outside `adapters/`. Importing, calling or exposing an outside library needs no adapter in core or client code, so applications get fewer findings and need no change.
- `effect/service-parameters` accepts a foreign resource passed between functions in any folder, and a default export implementing an imported foreign `Plugin` type is accepted in any folder.
- `effect/boundary`, `effect/service-parameters` and `effect/adapter-imports` describe `adapters/` as the one place for what Quality forbids elsewhere because a library requires it.
