# Changelog

## 0.3.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.0 - 2026-11-04

### Added

- Run local Codex through the shared agent port with session resume, dynamic tools, native images, queued turns, expected-turn steering, interruption, item transcripts, rate-limit and child-thread events, passive census, and exact-operation recovery after ambiguous submissions.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
