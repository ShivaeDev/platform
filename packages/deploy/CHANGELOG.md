# Changelog

## 0.3.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.2.0 - 2026-11-03

### Added

- Add `databaseService` for PostgreSQL with explicit resource limits and daily volume backups by default, with configurable backup schedules.
- Let web and worker services accept a PostgreSQL definition to wire `DATABASE_URL`, while preserving explicit application overrides.

## 0.1.0 - 2026-11-02

### Added

- Compose native Railway web and worker service definitions with overridable pre-deploy migration, trusted proxy, client-IP header and worker draining defaults.
