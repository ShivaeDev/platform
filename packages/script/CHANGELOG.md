# Changelog

## 0.2.0 - 2026-11-04

### Added

- Add `defineScript({ args, run })` as a Node entry point with inferred native Effect CLI arguments, environment Config, logging and Node services. Script scopes close on success, failure and Ctrl-C; ordinary typed failures exit with code 1 and interruptions with code 130.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-04

### Added

- Introduce a publishable package for scripts with no API yet.
