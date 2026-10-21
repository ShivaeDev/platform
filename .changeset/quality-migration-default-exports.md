---
"@shivaedev/quality": patch
---

### Changed

- The Biome preset lets numbered migration files in `src/server/migrations/`, including in nested apps, default-export their migration Effect, so applications drop their `noDefaultExport` exception for Effect's migration loader. Other files still may not default-export.
