### Added

- `migrationSteps(appMigrations)` from `migrationSteps.ts` provides `migrateTo("1_name")` and `migrateToLatest` on the current PostgreSQL client, so tests can seed old-schema rows before running a backfill. Unknown names fail with a typed `MigrationError`; loader dependencies and scope stay explicit.
- `makePostgresTestLayer({ prepare: false, ... })` skips migration and fixture preparation, giving isolated tests and test-story stories empty databases without a second migration list.
