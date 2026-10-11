### Changed

- Persist Fleet records and foreign reservations through effect-sql model repositories. Startup migrates existing JSONB records into field columns, retaining record versions, admission order and nested values. Daemon reads and writes continue against migrated PostgreSQL storage.

### Added

- Add schema-derived storage model and row-codec helpers in `storage/model.ts`, plus `modelTables`, `nextAdmissionOrder`, `checkRecordAdmission` and the generic `FleetStoreOptions<A>` type. `migrateFleet(namespace, schema?, legacyOnly?)` accepts a record schema for additional columns and can run the legacy migration batch independently.
- Add `recordValue(row, columns)` and `recordValues(rows, columns)` to decode storage fields before record-schema validation, and `Fleet.hasLaunchRetry()` (also available on the store) to query queued retry presence through a repository projection. Add `admissionReads(options, record, previous, limits)`, `FleetStoreOptions.admissionNeedsRecords(record, previous, limits)` and `needsAreaRecords(...)` so applications can omit unused admission snapshots while retaining locked capacity and quota checks.
- Add `publishAfterBoardPass(publication)` to coalesce status publication within a Board read pass and publish when it ends, including a failed pass. Calls outside a pass publish immediately.

### Fixed

- Avoid repeated full-record decoding and status publication within scheduler passes. Task discovery skips the generated Fleet status view and retains authored work at the same path. The real-PostgreSQL scheduler test admits and launches 100 tasks within five seconds with one metadata parse per task.
