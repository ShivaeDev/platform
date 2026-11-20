---
"@shivaedev/sql": minor
"@shivaedev/server": patch
---

### Breaking

- `@shivaedev/sql`: `migrationsFromDirectory` from `@shivaedev/sql/migrationsFromDirectory.ts` is now `loadMigrationsIn` from `@shivaedev/sql/loadMigrationsIn.ts`, so a call written when the argument was the application root no longer compiles. It takes the folder that contains `migrations`, the same argument as `migrationsIn` from `@shivaedev/server`. Replace `migrationsFromDirectory(applicationRoot)`, which read `src/server/migrations`, with `loadMigrationsIn(path.join(applicationRoot, "src/server"))`, or call `loadMigrationsIn(import.meta.dirname)` from a module beside the `migrations` folder.

### Changed

- `@shivaedev/sql`: When the `migrations` folder cannot be read, the `MigrationError` message names the folder it looked for and asks for the folder that contains `migrations`.
- `@shivaedev/server`: `migrationsIn` fails with that message when the directory it is given has no `migrations` folder.
