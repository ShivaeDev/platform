### Added

- Repositories accept an optional `versionColumn`: inserts initialize it to zero, updates match the expected version and increment it atomically, and deletes require the expected version. Stale or missing rows fail with typed `OptimisticConcurrencyError`; returned updated models carry the new version. PostgreSQL tests cover concurrent writers, versioned deletion and void writes. Unversioned repositories retain native CRUD behavior.
