# Changelog

## 0.2.0 - 2026-11-04

### Added

- Provides independent Effect bot REST and gateway services, typed failures, bucket and global rate-limit waits, and scoped reconnect/resume lifecycles.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-04

### Added

- Introduce a publishable package for Discord integrations with no API yet.
