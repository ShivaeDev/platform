---
"@shivaedev/deploy": minor
---

### Breaking

- `databaseService` yields `{ database, resources }` and declares its volume as a standalone resource, the way `railway config pull` writes it, instead of adding `volumeAttachments` to the database. Plans against a project that already has the volume no longer list a change for it. To migrate, change `const database = yield* databaseService(...)` to `const { database, resources } = yield* databaseService(...)`, replace `database` in the project's list with `...resources`, and copy the volume's name and config from your pulled file into `volume(name, config)`.
