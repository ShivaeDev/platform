---
"@shivaedev/test-sql": minor
---

### Added

- Read live PostgreSQL column names and exact types with `tableColumns(table)`, without requiring migrations. Migration upgrade checks reuse this readout.

### Breaking

- Import the `PostgresColumn` type from `@shivaedev/test-sql/server/tableColumns.ts` instead of `@shivaedev/test-sql/server/migrationUpgrade.ts`.
