# Changelog

## 0.7.0 - 2026-11-21

### Breaking

- import from `@shivaedev/agent-codex/Request.ts` instead of `@shivaedev/agent-codex/adapters/Request.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/UserMessageItem.ts` instead of `@shivaedev/agent-codex/adapters/UserMessageItem.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/attributed.ts` instead of `@shivaedev/agent-codex/adapters/attributed.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/backend.ts` instead of `@shivaedev/agent-codex/adapters/backend.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/census.ts` instead of `@shivaedev/agent-codex/adapters/census.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/codexFailure.ts` instead of `@shivaedev/agent-codex/adapters/codexFailure.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/configuredBackend.ts` instead of `@shivaedev/agent-codex/adapters/configuredBackend.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/deliveryState.ts` instead of `@shivaedev/agent-codex/adapters/deliveryState.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/engine.ts` instead of `@shivaedev/agent-codex/adapters/engine.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/features.ts` instead of `@shivaedev/agent-codex/adapters/features.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/handshake.ts` instead of `@shivaedev/agent-codex/adapters/handshake.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/initializeCodex.ts` instead of `@shivaedev/agent-codex/adapters/initializeCodex.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/initializeEngine.ts` instead of `@shivaedev/agent-codex/adapters/initializeEngine.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/items.ts` instead of `@shivaedev/agent-codex/adapters/items.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/mapping.ts` instead of `@shivaedev/agent-codex/adapters/mapping.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/protocol.ts` instead of `@shivaedev/agent-codex/adapters/protocol.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/protocolItems.ts` instead of `@shivaedev/agent-codex/adapters/protocolItems.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/rateLimitEvents.ts` instead of `@shivaedev/agent-codex/adapters/rateLimitEvents.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/reads.ts` instead of `@shivaedev/agent-codex/adapters/reads.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/recovery.ts` instead of `@shivaedev/agent-codex/adapters/recovery.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/residualApproval.ts` instead of `@shivaedev/agent-codex/adapters/residualApproval.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/rpc.ts` instead of `@shivaedev/agent-codex/adapters/rpc.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/rpcProtocol.ts` instead of `@shivaedev/agent-codex/adapters/rpcProtocol.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/session.ts` instead of `@shivaedev/agent-codex/adapters/session.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/subagentItems.ts` instead of `@shivaedev/agent-codex/adapters/subagentItems.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/tellCliVersionOnce.ts` instead of `@shivaedev/agent-codex/adapters/tellCliVersionOnce.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/threadClaims.ts` instead of `@shivaedev/agent-codex/adapters/threadClaims.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/threadSweep.ts` instead of `@shivaedev/agent-codex/adapters/threadSweep.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/threadTree.ts` instead of `@shivaedev/agent-codex/adapters/threadTree.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/turnRequests.ts` instead of `@shivaedev/agent-codex/adapters/turnRequests.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-codex/userMessageEvent.ts` instead of `@shivaedev/agent-codex/adapters/userMessageEvent.ts`, which moved out of `adapters/`.

## 0.6.5 - 2026-11-20

### Changed

- Require Effect 4.1.4 and its matching platform packages.

## 0.6.4 - 2026-11-11

### Changed

- Align published dependency requirements with the workspace.

## 0.6.3 - 2026-11-08

### Changed

- Update `@shivaedev/service` from 0.8.2 to 0.9.0.

## 0.6.2 - 2026-11-07

### Changed

- Update `@shivaedev/service` from 0.8.1 to 0.8.2.

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
