# Changelog

## 0.4.4 - 2026-11-11

### Changed

- Align published dependency requirements with the workspace.

## 0.4.3 - 2026-11-08

### Changed

- Update `@shivaedev/service` from 0.8.2 to 0.9.0.

## 0.4.2 - 2026-11-07

### Changed

- Update `@shivaedev/service` from 0.8.1 to 0.8.2.

## 0.4.1 - 2026-11-07

### Changed

- Require Effect 4.1.1 and its matching platform packages.

## 0.4.0 - 2026-11-05

### Changed

- REST operations yield their declared dependencies; a dedicated rate-limit service owns pacing state for the registered Layer's lifetime. REST and gateway operations have named tracing spans.

### Breaking

- Import `DiscordRest` from `@shivaedev/discord/rest/service.ts` and provide `layer` from `@shivaedev/discord/rest/layer.ts` in place of `DiscordRest.layer`. The composed Layer supplies the rate-limit service; continue supplying the native HTTP client, bot token and optional config once at registration.
- Import `DiscordGateway` from `@shivaedev/discord/gateway/service.ts`. Its Layer and `run(handler)` signature stay the same.
- Replace direct uses of the removed `restClient.ts` and `rateLimits.ts` factories with the composed REST Layer and `DiscordRest.request`. Direct gateway integrations import `run` from `gateway/run.ts` and `gatewayConnection` from `adapters/gatewayConnection.ts` instead of `runGateway.ts` and `gatewayConnection.ts`.

## 0.3.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.2.2 - 2026-11-05

### Changed

- Update `@shivaedev/http` from 0.6.1 to 0.7.0.

## 0.2.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.2.0 - 2026-11-04

### Added

- Provides independent Effect bot REST and gateway services, typed failures, bucket and global rate-limit waits, and scoped reconnect/resume lifecycles.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-04

### Added

- Introduce a publishable package for Discord integrations with no API yet.
