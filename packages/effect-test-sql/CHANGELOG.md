# Changelog

## 0.1.0 - 2026-10-11

### Added

- `makePostgresTestLayer` prepares migrations and optional fixtures once in a PostgreSQL template and provides native services on a shared test database. `withTestTransaction` wraps harness setup, the body and scope finalizers in rollback, preserves nested `transact` savepoints, and discards commit-bound invalidations. `withIsolatedDatabase` clones the prepared template for real commits and drops the clone after the test. The Layer scope drops its shared database and template. Real PostgreSQL tests cover concurrency, row-lock release, failure and interruption, template reuse, second-connection commit visibility and resource cleanup.
