### Breaking

- Remove `makePostgresFleetStore(...).initialize()`, the `storage/migrateFleet.ts` export and the `legacyOnly` argument to `fleetMigrations`. Migrate through `appDatabase` with the `fleetMigrations(namespace)` loader before using the store.
