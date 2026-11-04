# Changelog

## 0.2.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.2.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-03

### Added

- Run scoped background reconciliation at startup, on changes keys or at a reported due time, with merged pending wakes and no polling interval.
- Supervise failures independently with readable state, typed termination, resume and optional application-owned failure persistence.
- Run keyed actions once while each key remains present, interrupting removed work and isolating child failures.
