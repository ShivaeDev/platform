---
"@shivaedev/quality": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/quality`: Report value imports of outside runtime dependencies, peers, optional dependencies and Node builtins outside `adapters/` with `effect/adapter-imports`. Keep type imports, Effect and `@shivaedev` framework packages, workspace modules, `test-support/` kits and React in `client/` folders available. Move integrations into adapters and expose Effect values, or use `import type` when only a type is needed.
- `@shivaedev/server`: Provide `sendHostReady` in the server's host-process testing adapter to report the current process ID and listening URL over IPC.
