# Changelog

## 0.4.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.3.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.3.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.0 - 2026-11-03

### Added

- Supervise local application processes in per-attempt Effect scopes, with readiness deadlines, captured stdout and stderr, capped exponential restart backoff, and graceful shutdown that escalates to SIGKILL.
- Decode JSON readiness handshakes, compose dependency start order in application Effects, and observe current readiness and typed failures through native Effect values.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
