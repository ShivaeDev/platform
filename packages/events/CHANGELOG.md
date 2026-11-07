# Changelog

## 0.4.4 - 2026-11-07

### Changed

- Update `@shivaedev/sql` from 0.45.0 to 0.46.0.

## 0.4.3 - 2026-11-06

### Changed

- Update `@shivaedev/sql` from 0.44.0 to 0.45.0.

## 0.4.2 - 2026-11-06

### Changed

- Update `@shivaedev/sql` from 0.43.0 to 0.44.0.

## 0.4.1 - 2026-11-05

### Changed

- Update `@shivaedev/sql` from 0.42.0 to 0.43.0.

## 0.4.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.3.4 - 2026-11-05

### Changed

- Update `@shivaedev/sql` from 0.40.0 to 0.41.0.

## 0.3.3 - 2026-11-04

### Changed

- Update `@shivaedev/sql` from 0.39.0 to 0.40.0.

## 0.3.2 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.3.1 - 2026-11-04

### Changed

- Update `@shivaedev/sql` from 0.37.0 to 0.38.0.

## 0.3.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.0 - 2026-11-04

### Added

- Accept empty event batches in `append` to record durable request receipts at the existing stream version without appending events, running projections or publishing change keys. Retries retain the original receipt version after later events.

## 0.1.1 - 2026-11-03

### Changed

- Update `@shivaedev/sql` from 0.35.0 to 0.36.0.

## 0.1.0 - 2026-11-03

### Added

- Keep optional durable feature history with versioned Effect Schema events, stable request ids and expected stream versions on PostgreSQL. Project through SQL repositories in the append transaction, rebuild read models with database-only projections and upcast historical payloads. Per-stream projection progress keeps late commits eligible for catch-up.
