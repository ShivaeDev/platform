---
"@shivaedev/sql": minor
"@shivaedev/server": patch
---

### Changed

- `@shivaedev/server`: `migrationsIn(directory)` finds the `migrations` folder in `directory` through `migrationsFromDirectory` from `@shivaedev/sql/migrationsFromDirectory.ts`, so a module registration and a runner outside the host share one discovery path and one folder convention.

### Breaking

- `@shivaedev/sql`: `migrationsFromDirectory(directory)` reads the `migrations` folder in `directory` instead of `src/server/migrations` under an application root, so it works from any registration's own directory. Pass the directory that holds the folder: replace `migrationsFromDirectory(process.cwd())` with `migrationsFromDirectory(import.meta.dirname)` in a file in `src/server/`, or with `migrationsFromDirectory(path.join(root, "src/server"))`. A directory without a `migrations` folder still fails the run with `MigrationError` (`kind: "Failed"`).
- `@shivaedev/sql`: `migration.ts` exports `MIGRATIONS_FOLDER` (`"migrations"`), the folder name discovery appends, in place of `MIGRATIONS_DIRECTORY` (`"src/server/migrations"`). Replace `MIGRATIONS_DIRECTORY` with `MIGRATIONS_FOLDER` joined to the directory that holds the folder, such as `` `src/server/${MIGRATIONS_FOLDER}` ``.
