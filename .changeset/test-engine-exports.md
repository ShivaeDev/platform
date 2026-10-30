---
"@shivaedev/test": minor
"@shivaedev/test-story": minor
"@shivaedev/test-sql": minor
"@shivaedev/vitest-rerun": minor
---

### Added

- Export every engine module through the package's existing `.ts` wildcard, including modules under `internal/` in `test` and `vitest-rerun` and `server/internal/` in `test-story` and `test-sql`, so downstream kits can reuse them directly.
