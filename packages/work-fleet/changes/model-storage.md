### Changed

- Persist Fleet records and foreign reservations through effect-sql model repositories. Startup migrates existing JSONB records into field columns, retaining record versions, admission order and nested values. Daemon reads and writes continue against migrated PostgreSQL storage.

### Added

- Add schema-derived storage model and row-codec helpers in `storage/model.ts`, plus `modelTables`, `nextAdmissionOrder`, `checkRecordAdmission` and the generic `FleetStoreOptions<A>` type. `migrateFleet(namespace, schema?, legacyOnly?)` accepts a record schema for additional columns and can run the legacy migration batch independently.
