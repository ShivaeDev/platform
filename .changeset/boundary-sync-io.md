---
"@shivaedev/quality": minor
---

### Breaking

- `effect/boundary` reports synchronous Node filesystem and child-process calls, core `Effect.run*` runners, Promise parameters and callbacks, throwing APIs inside `Effect.sync`, and each call to a helper that throws. Move IO to Effect services, yield computations in the current runtime, and use `Effect.try` with tagged failures for throwing work. Outside-library bridges belong in `adapters/`. Record retained first-adoption debt with `quality baseline write --rule effect/boundary`, then lower it with `quality baseline tighten` as repairs land. Runners remain accepted at entry points, in tool configs and in tests.
- Consumers calling `runtimeOf` or `runtimeDeclarationProblems` from `@shivaedev/quality/imports/runtime.ts` must provide Effect's `FileSystem.FileSystem` service, for example with `NodeFileSystem.layer`. Directory probes now use that service and report filesystem failures as `FilesystemFailure`; only missing directories are treated as absent.
