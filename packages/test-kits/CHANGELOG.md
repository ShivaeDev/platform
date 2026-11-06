# Changelog

## 0.8.1 - 2026-11-05

### Changed

- Update `@shivaedev/contract` from 0.39.0 to 0.40.0.
- Update `@shivaedev/discord` from 0.3.0 to 0.4.0.
- Update `@shivaedev/email` from 0.6.0 to 0.7.0.
- Update `@shivaedev/identity` from 0.27.0 to 0.28.0.
- Update `@shivaedev/jobs` from 0.39.0 to 0.40.0.
- Update `@shivaedev/sql` from 0.42.0 to 0.43.0.
- Update `@shivaedev/test-sql` from 0.24.0 to 0.24.1.
- Update `@shivaedev/test-story` from 0.42.0 to 0.42.1.
- Update `@shivaedev/webhooks` from 0.11.0 to 0.11.1.

## 0.8.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.7.0 - 2026-11-05

### Breaking

- Replace `jobs/internal/` with `jobs/` in module imports.

## 0.6.0 - 2026-11-05

### Added

- Publish host process and controlled clock helpers, settled query observations and signed webhook delivery helpers.
- Publish `fakeOauthProvider` for application sign-in stories over real HTTP, with OAuth authorization codes, consent refusal, controlled expiry, profiles and OIDC discovery with signed ID tokens.

## 0.5.0 - 2026-11-04

### Added

- Publish a scoped fake GitHub App with real HTTP installation-token exchanges, configurable REST and GraphQL routes, provider fault controls and signed webhook delivery for application stories.

## 0.4.0 - 2026-11-04

### Added

- Provide the pg-boss testing controller in test-kits, using jobs’ public client and inspection service with the real PostgreSQL engine.

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.3.1 - 2026-11-04

### Changed

- Update `@shivaedev/email` from 0.4.0 to 0.4.1.
- Update `@shivaedev/identity` from 0.24.0 to 0.25.0.
- Update `@shivaedev/sql` from 0.37.0 to 0.38.0.
- Update `@shivaedev/test-sql` from 0.20.0 to 0.21.0.
- Update `@shivaedev/test-story` from 0.38.0 to 0.39.0.

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
