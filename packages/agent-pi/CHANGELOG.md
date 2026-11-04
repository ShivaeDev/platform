# Changelog

## 0.3.0 - 2026-11-04

### Added

- Run embedded Pi sessions through the shared agent port, with preflight acceptance, file-backed resume, credential-aware models, distinct follow-up and steering delivery, scoped abort and disposal, and provider event conversion. Keep retrying runs open and preserve unmapped events as raw payloads. The Pi coding-agent SDK is an optional peer; image input and transcript reads remain unsupported.

## 0.2.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.1.0 - 2026-11-03

### Added

- Publish a package skeleton with no API yet.
