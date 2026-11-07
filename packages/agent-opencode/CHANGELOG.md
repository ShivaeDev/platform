# Changelog

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
