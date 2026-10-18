---
"@shivaedev/effect-pg-boss": minor
---

### Added

- `installPgBossSchema(options?: PgBossSchemaOptions)` in `schema.ts` installs or upgrades the pg-boss schema through an Effect SQL client without starting workers or schedules. Use it in a test template fixture or release step, then start jobs Layers with `migrate: false`. Failures use `PgBossError` with the new `"install"` operation. Retrying a failed concurrent upgrade rebuilds missing and invalid managed indexes even when the schema version has already committed.
