# Changelog

## 0.6.0 - 2026-11-21

### Breaking

- import from `@shivaedev/agent-claude-code/ClaudeProvider.ts` instead of `@shivaedev/agent-claude-code/adapters/ClaudeProvider.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/blocks.ts` instead of `@shivaedev/agent-claude-code/adapters/blocks.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/mirrorKeys.ts` instead of `@shivaedev/agent-claude-code/adapters/mirrorKeys.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/openSessionMapping.ts` instead of `@shivaedev/agent-claude-code/adapters/openSessionMapping.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/openSubsessions.ts` instead of `@shivaedev/agent-claude-code/adapters/openSubsessions.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/openTurnUsage.ts` instead of `@shivaedev/agent-claude-code/adapters/openTurnUsage.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/openWorkflowNodes.ts` instead of `@shivaedev/agent-claude-code/adapters/openWorkflowNodes.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/rateLimitEvent.ts` instead of `@shivaedev/agent-claude-code/adapters/rateLimitEvent.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/rawPayload.ts` instead of `@shivaedev/agent-claude-code/adapters/rawPayload.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/sessionLanes.ts` instead of `@shivaedev/agent-claude-code/adapters/sessionLanes.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/sessionOptions.ts` instead of `@shivaedev/agent-claude-code/adapters/sessionOptions.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/spilledPreview.ts` instead of `@shivaedev/agent-claude-code/adapters/spilledPreview.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/subsessionEndings.ts` instead of `@shivaedev/agent-claude-code/adapters/subsessionEndings.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/systemEvents.ts` instead of `@shivaedev/agent-claude-code/adapters/systemEvents.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/toolIdentity.ts` instead of `@shivaedev/agent-claude-code/adapters/toolIdentity.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/transcriptEvents.ts` instead of `@shivaedev/agent-claude-code/adapters/transcriptEvents.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/workflowAdoption.ts` instead of `@shivaedev/agent-claude-code/adapters/workflowAdoption.ts`, which moved out of `adapters/`.
- import from `@shivaedev/agent-claude-code/workflowIdentity.ts` instead of `@shivaedev/agent-claude-code/adapters/workflowIdentity.ts`, which moved out of `adapters/`.

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

- Import the tool server adapter from `adapters/makeToolServer.ts` instead of `adapters/toolServer.ts`.

## 0.4.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.3.0 - 2026-11-04

### Added

- Implement the shared agent port for Claude Code with native session resume, distinct queued input and priority-now steering, interruption and scoped query cleanup.
- Bind application MCP tools and convert provider messages, child lineage, usage and cost into shared agent events.
- Reconcile stream, mirror and repair transcript lanes by provider UUID, declaring missing and spilled output as explicit gaps. Keep the Claude and MCP SDKs optional peers; image input and model discovery remain unsupported.

## 0.2.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
