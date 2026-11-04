# Changelog

## 0.3.0 - 2026-11-04

### Added

- Provides a stateful Discord provider with message HTTP routes and a native gateway socket boundary for stories running the real clients.

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.2 - 2026-11-04

### Changed

- Update `@shivaedev/contract` from 0.34.0 to 0.35.0.
- Update `@shivaedev/identity` from 0.23.0 to 0.23.1.
- Update `@shivaedev/test-sql` from 0.18.2 to 0.19.0.
- Update `@shivaedev/test-story` from 0.37.0 to 0.37.1.

## 0.2.1 - 2026-11-04

### Changed

- Update `@shivaedev/contract` from 0.33.1 to 0.34.0.
- Update `@shivaedev/email` from 0.3.1 to 0.3.2.
- Update `@shivaedev/identity` from 0.22.1 to 0.23.0.
- Update `@shivaedev/sql` from 0.36.0 to 0.36.1.
- Update `@shivaedev/test-sql` from 0.18.1 to 0.18.2.
- Update `@shivaedev/test-story` from 0.36.1 to 0.37.0.

## 0.2.0 - 2026-11-03

### Added

- Issue valid MCP bearer tokens with `mcpBearerToken` using the application's Better Auth issuer, signing key and persisted consent grant, so application stories exercise live grant checks.

## 0.1.1 - 2026-11-03

### Changed

- Update `@shivaedev/identity` from 0.21.0 to 0.22.0.

## 0.1.0 - 2026-11-03

### Added

- Compose email inboxes, Better Auth session preconditions, PostgreSQL change assertions and native RPC subscription helpers in application story kits through domain-specific imports.
