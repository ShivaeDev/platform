### Added

- `appHost` and `appDatabase` accept `migrations.mode: "wait"` to poll the migration ledger before starting application services, with configurable `pollInterval` (one second by default) and `waitTimeout` (five minutes by default). Timeout preserves the schema check's native `MigrationError`, and interruption closes the waiting host's database pool.
- `server/MigrationOptions.ts` exports `MigrationOptions<R = never>`, the migration settings used by `AppDatabaseOptions.migrations`.
