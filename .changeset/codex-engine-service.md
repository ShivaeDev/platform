---
"@shivaedev/agent-codex": minor
---

### Breaking

- Import `Codex` from `@shivaedev/agent-codex/codex/service.ts` and `codexLayer` from `@shivaedev/agent-codex/codexLayer.ts` instead of the former combined module. Provide `codexLayer` with `CodexConfig`; it supplies the adapter engine service for every Codex operation. Replace direct adapter `engine(config, spawn)` construction with this Layer; custom process adapters provide `ProcessSpawner` from `@shivaedev/agent-codex/adapters/process.ts` through a Layer.
- Replace the spawn callback arguments to the low-level `initializeEngine` and `openServer` adapters with `ProcessSpawner` provision. Use `codexLayer` instead of calling `initializeCodex` or `configuredBackend` directly; initialization now returns the configured engine interface, and backend assembly yields `Codex` from the environment.
- The low-level adapter `backend(state)` returns the configured backend directly. Remove the trailing function call and Effect execution when constructing it; application code continues to call the Effect-returning `Codex.backend()` operation.
