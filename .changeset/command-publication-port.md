---
"@shivaedev/changes": minor
"@shivaedev/sql": minor
"@shivaedev/identity": patch
---

### Added

- `@shivaedev/changes`: `commandPublication.ts` exports the `CommandPublication` port, its `CommandPublisher` interface and typed `CommandPublicationError`. The default publishes local Reactivity invalidations.
- `@shivaedev/sql`: The `postgresChanges` binding implements `CommandPublication` with PostgreSQL publication and recovery through local resynchronization and a Resync broadcast.

### Changed

- `@shivaedev/identity`: Publish declared command changes and recover failed publication through `CommandPublication`, preserving the committed command result and its bounded publication retries.

### Breaking

- `@shivaedev/sql`: Replace `CommandRecovery` from `@shivaedev/sql/internal/CommandRecovery.ts` with `CommandPublication` from `@shivaedev/changes/commandPublication.ts`: yield the port and run its `recover` Effect. Custom providers now supply `{ publish, recover }`; both operations fail with `CommandPublicationError`, so consumers must handle recovery failures. `postgresChanges` provides both operations.
- `@shivaedev/sql`: Import `MigrationStartedAt` from `@shivaedev/sql/MigrationStartedAt.ts` instead of `@shivaedev/sql/internal/MigrationStartedAt.ts`. Its service identifier is now `@shivaedev/sql/MigrationStartedAt`; provide the exported reference.
- `@shivaedev/sql`: Import `migrationLock` from `@shivaedev/sql/migrationLock.ts` instead of `@shivaedev/sql/internal/migrationLock.ts`. The SQL `internal` import paths are removed without aliases.
