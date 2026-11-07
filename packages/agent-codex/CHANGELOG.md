# Changelog

## 0.6.1 - 2026-11-07

### Changed

- Require Effect 4.1.1 and its matching platform packages.

## 0.6.0 - 2026-11-06

### Breaking

- Import the rate-limit event adapter from `adapters/rateLimitEvents.ts` instead of `adapters/rateLimits.ts`.

## 0.5.0 - 2026-11-05

### Breaking

- Import `Codex` from `@shivaedev/agent-codex/codex/service.ts` and `codexLayer` from `@shivaedev/agent-codex/codexLayer.ts` instead of the former combined module. Provide `codexLayer` with `CodexConfig`; it supplies the adapter engine service for every Codex operation. Replace direct adapter `engine(config, spawn)` construction with this Layer; custom process adapters provide `ProcessSpawner` from `@shivaedev/agent-codex/adapters/process.ts` through a Layer.
- Replace the spawn callback arguments to the low-level `initializeEngine` and `openServer` adapters with `ProcessSpawner` provision. Use `codexLayer` instead of calling `initializeCodex` or `configuredBackend` directly; initialization now returns the configured engine interface, and backend assembly yields `Codex` from the environment.
- The low-level adapter `backend(state)` returns the configured backend directly. Remove the trailing function call and Effect execution when constructing it; application code continues to call the Effect-returning `Codex.backend()` operation.

## 0.4.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.3.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.3.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.0 - 2026-11-04

### Added

- Run local Codex through the shared agent port with session resume, dynamic tools, native images, queued turns, expected-turn steering, interruption, item transcripts, rate-limit and child-thread events, passive census, and exact-operation recovery after ambiguous submissions.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
