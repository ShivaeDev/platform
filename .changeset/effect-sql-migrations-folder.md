---
"@shivaedev/effect-sql": minor
"@shivaedev/create-app": minor
---

### Added

- effect-sql exports `MIGRATIONS_DIRECTORY` and `MIGRATION_FILE_PATTERN` from `migrationConvention.ts`, and `migrationsFromDirectory(root)` to discover the app's sequentially numbered migration files with Effect's filesystem loader.
- create-app ships the starter's discovered `src/server/migrations/` folder and validates its zero-padded sequential filenames when packing the template.
