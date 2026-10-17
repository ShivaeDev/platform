### Added

- `PostgresTestOptions.maxConnections` configures the preparation, shared and isolated database pool limit per suite.

### Fixed

- Test database pools default to two connections, and administrative connections close after each create or drop, so concurrent database copies use a smaller PostgreSQL connection budget.
- Setup, rollback and isolated test wrappers explain PostgreSQL connection-limit failures with `max_connections` and a `vitest run --maxWorkers=4` suggestion while retaining SQLSTATE `53300`.
