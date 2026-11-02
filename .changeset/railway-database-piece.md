---
"@shivaedev/deploy": minor
---

### Added

- Add `databaseService` for PostgreSQL with explicit resource limits and daily volume backups by default, with configurable backup schedules.
- Let web and worker services accept a PostgreSQL definition to wire `DATABASE_URL`, while preserving explicit application overrides.
