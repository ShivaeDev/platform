---
"@shivaedev/server": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/server`: `migrationsIn(directory)` from `@shivaedev/server/adapters/migrationsIn.ts` returns an `AppModule` `migrations` value whose loader reads the `migrations` folder in `directory` with `MigratorFileSystem.fromFileSystem` under `NodeServices.layer`, so a registration writes `migrations: migrationsIn(import.meta.dirname)`. It needs the optional peer `@effect/platform-node`.
- `@shivaedev/server`: `AppModule.migrations` is optional. A module without migrations leaves it out, and `appModules` combines the loaders and schema components of the modules that declare them.

### Changed

- `@shivaedev/server`: `appModules` names a defined module by its own name in `DuplicateModuleQueue`.
- `@shivaedev/create-app`: `create-app resource` writes the module's registration with `migrations: migrationsIn(import.meta.dirname)` and without a `name`.

### Breaking

- `@shivaedev/server`: A registration with `module:` no longer accepts `name`: the module already carries its name, and a second one could disagree with it. Delete the `name` line from each `module:` registration. A `group` plus `handlers` registration still requires `name`.
