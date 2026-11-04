# Changelog

## 0.1.1 - 2026-11-03

### Changed

- Update `@shivaedev/sql` from 0.35.0 to 0.36.0.

## 0.1.0 - 2026-11-03

### Added

- Keep optional durable feature history with versioned Effect Schema events, stable request ids and expected stream versions on PostgreSQL. Project through SQL repositories in the append transaction, rebuild read models with database-only projections and upcast historical payloads. Per-stream projection progress keeps late commits eligible for catch-up.
