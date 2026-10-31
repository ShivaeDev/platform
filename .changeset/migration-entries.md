---
"@shivaedev/quality": patch
---

### Fixed

- `code/unused` treats numbered migrations in `src/server/migrations` and `src/modules/<module>/server/migrations` as entry points, because migration runners load them from their directory, so apps no longer baseline every migration as an unused file.
