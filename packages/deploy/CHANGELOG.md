# Changelog

## 0.4.0 - 2026-11-06

### Breaking

- Await `databaseService(...)`, including inside an async `defineRailway` callback. It now verifies Railway's Postgres image ENTRYPOINT and CMD before returning a definition; registry failures and changed startup chains stop deployment.
- Supply `volume: volume("your-existing-volume-name")` from `railway/iac`, using the attached volume's exact name for existing databases. Backup schedules now reach Railway through native volume attachments and default to daily, weekly and monthly. Explicit schedules, `[]` and `null` remain supported.
- The default start command trims clean Postgres file cache above 250 MiB or after 15 minutes, checking every 30 seconds. Override the three `pageCacheTrim` numeric options as needed. Remove any PITR option and archive/pgBackRest configuration, and disable Railway PITR and HA before adopting this command; scheduled volume backups replace them.
- Image updates default to immediate minor and patch updates with SHA tracking. For an existing database whose image tag is unchanged, set this policy once through Railway's image source settings or API, as described in the README, because the CLI skips its source diff.

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
