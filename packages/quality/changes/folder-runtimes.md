### Added

- `imports/runtime` infers browser code in `src/client/`, server code in `src/server/` and shared code elsewhere, for packages with either runtime folder. It rejects runtime-crossing imports and shared browser globals or Node built-ins while existing explicit fences remain active.
- Shared browser-global checks include runtime destructuring defaults and class superclass expressions, while leaving locally bound names, type annotations, implements clauses and interface heritage outside the global value scan.
