# Changelog

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
