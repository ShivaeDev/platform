# Changelog

## 0.6.8 - 2026-11-08

### Changed

- Update `@shivaedev/sql` from 0.46.3 to 0.46.4.

## 0.6.7 - 2026-11-07

### Changed

- Update `@shivaedev/sql` from 0.46.2 to 0.46.3.

## 0.6.6 - 2026-11-07

### Changed

- Update `@shivaedev/sql` from 0.46.1 to 0.46.2.

## 0.6.5 - 2026-11-07

### Changed

- Update `@shivaedev/errors` from 0.10.0 to 0.10.1.
- Update `@shivaedev/sql` from 0.46.0 to 0.46.1.

## 0.6.4 - 2026-11-07

### Changed

- Update `@shivaedev/sql` from 0.45.0 to 0.46.0.

## 0.6.3 - 2026-11-06

### Changed

- Update `@shivaedev/sql` from 0.44.0 to 0.45.0.

## 0.6.2 - 2026-11-06

### Changed

- Update `@shivaedev/sql` from 0.43.0 to 0.44.0.

## 0.6.1 - 2026-11-05

### Changed

- Update `@shivaedev/sql` from 0.42.0 to 0.43.0.

## 0.6.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.5.3 - 2026-11-05

### Changed

- Update `@shivaedev/sql` from 0.40.0 to 0.41.0.

## 0.5.2 - 2026-11-04

### Changed

- Update `@shivaedev/sql` from 0.39.0 to 0.40.0.

## 0.5.1 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.5.0 - 2026-11-04

### Added

- The PostgreSQL story fixture exposes `elapseWindows(duration)` to age stored reservations without waiting on wall time.

## 0.4.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.3.3 - 2026-11-04

### Changed

- Update `@shivaedev/errors` from 0.7.0 to 0.8.0.
- Update `@shivaedev/sql` from 0.36.0 to 0.36.1.

## 0.3.2 - 2026-11-03

### Changed

- Update `@shivaedev/sql` from 0.35.0 to 0.36.0.

## 0.3.1 - 2026-11-03

### Changed

- Update `@shivaedev/errors` from 0.6.0 to 0.7.0.
- Update `@shivaedev/sql` from 0.34.0 to 0.35.0.

## 0.3.0 - 2026-11-03

### Added

- Expose `postgresTestDatabase` with an `expireWindows` fixture for isolated PostgreSQL stories exercising expired budgets.

## 0.2.1 - 2026-11-02

### Changed

- Update `@shivaedev/sql` from 0.32.0 to 0.33.0.

## 0.2.0 - 2026-11-02

### Added

- `@shivaedev/errors`' shared `TooManyRequests` accepts optional `key` and `retryAt` fields, preserving rate-limit details across RPC while still accepting message-only failures.

### Breaking

- `@shivaedev/rate-limit` now fails with the shared `TooManyRequests`. Replace imports from `@shivaedev/rate-limit/TooManyRequests.ts` with `@shivaedev/errors/taxonomy.ts` and add `@shivaedev/errors` as a dependency. Use that shared schema in contract rejections and custom stores. Its `key` and `retryAt` fields are optional because other callers can create message-only failures; check for their presence before using them. The limiter continues to supply both fields. The old module is removed without an alias.

## 0.1.0 - 2026-11-01

### Added

- Admit per-key budgets through `@shivaedev/rate-limit`, with an Effect-clock memory store, a PostgreSQL adapter, and typed `TooManyRequests` carrying a retry time.
- Include rate limiting in Platform and demonstrate a per-user note creation budget in generated applications.
