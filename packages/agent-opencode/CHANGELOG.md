# Changelog

## 0.6.1 - 2026-11-21

### Changed

- Update `@shivaedev/http` from 0.9.2 to 0.9.3.

## 0.6.0 - 2026-11-21

### Breaking

- import from `@shivaedev/agent-opencode/MessageUpdatedProperties.ts` instead of `@shivaedev/agent-opencode/adapters/MessageUpdatedProperties.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/OpencodeRequest.ts` instead of `@shivaedev/agent-opencode/adapters/OpencodeRequest.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/listeningUrl.ts` instead of `@shivaedev/agent-opencode/adapters/listeningUrl.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/mapping.ts` instead of `@shivaedev/agent-opencode/adapters/mapping.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/messageAuthors.ts` instead of `@shivaedev/agent-opencode/adapters/messageAuthors.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/openSseBuffer.ts` instead of `@shivaedev/agent-opencode/adapters/openSseBuffer.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/openTurnBoundary.ts` instead of `@shivaedev/agent-opencode/adapters/openTurnBoundary.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/opencodePlugin.config.ts` instead of `@shivaedev/agent-opencode/adapters/opencodePlugin.config.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/partEvents.ts` instead of `@shivaedev/agent-opencode/adapters/partEvents.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/projection.ts` instead of `@shivaedev/agent-opencode/adapters/projection.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/protocol.ts` instead of `@shivaedev/agent-opencode/adapters/protocol.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/protocolParts.ts` instead of `@shivaedev/agent-opencode/adapters/protocolParts.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/sessionFrames.ts` instead of `@shivaedev/agent-opencode/adapters/sessionFrames.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/toolEvents.ts` instead of `@shivaedev/agent-opencode/adapters/toolEvents.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/toolSessions.ts` instead of `@shivaedev/agent-opencode/adapters/toolSessions.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-opencode/wireName.ts` instead of `@shivaedev/agent-opencode/adapters/wireName.ts`, which moved out of `adapters/`.

## 0.5.5 - 2026-11-20

### Changed

- Update `@shivaedev/http` from 0.9.1 to 0.9.2.

## 0.5.4 - 2026-11-20

### Changed

- Update `@shivaedev/http` from 0.9.0 to 0.9.1.

## 0.5.3 - 2026-11-20

### Changed

- Require Effect 4.1.4 and its matching platform packages.

## 0.5.2 - 2026-11-11

### Changed

- Align published dependency requirements with the workspace.

## 0.5.1 - 2026-11-07

### Changed

- Require Effect 4.1.1 and its matching platform packages.

## 0.5.0 - 2026-11-06

### Breaking

- Import the tool naming adapter from `adapters/wireName.ts` instead of `adapters/toolNames.ts`.

## 0.4.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.3.2 - 2026-11-05

### Changed

- Update `@shivaedev/http` from 0.6.1 to 0.7.0.

## 0.3.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.
- Require `@modelcontextprotocol/sdk` 1.32.0 as the optional peer. It fixes the SDK advisories GHSA-6qxp-vccf-f47h, GHSA-6prh-2h8m-c8cw, GHSA-22jm-h49p-29qw and GHSA-rvq5-wwqv-78pq; install 1.32.0 alongside the OpenCode agent.

## 0.3.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.0 - 2026-11-04

### Added

- OpenCode backend for the shared agent port with HTTP and SSE transport, scoped session events, queued and active text delivery, abort, model discovery and session-bound MCP tools. Image input and transcript history remain explicitly unsupported. Requires the OpenCode executable; the MCP SDK is an optional peer for the tool bridge.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
