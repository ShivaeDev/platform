# Changelog

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
