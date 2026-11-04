# Changelog

## 0.3.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.0 - 2026-11-04

### Added

- Negotiate coding-agent requirements before provider calls and expose a typed run facade with explicit optional feature implementations.
- Define Schema receipts, execution observations, acceptance reconciliation, events and failures without provider SDK or persistence dependencies.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
