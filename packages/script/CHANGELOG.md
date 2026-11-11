# Changelog

## 0.3.2 - 2026-11-11

### Changed

- Align published dependency requirements with the workspace.

## 0.3.1 - 2026-11-07

### Changed

- Require Effect 4.1.1 and its matching platform packages.

## 0.3.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.2.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.2.0 - 2026-11-04

### Added

- Add `defineScript({ args, run })` as a Node entry point with inferred native Effect CLI arguments, environment Config, logging and Node services. Script scopes close on success, failure and Ctrl-C; ordinary typed failures exit with code 1 and interruptions with code 130.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-04

### Added

- Introduce a publishable package for scripts with no API yet.
