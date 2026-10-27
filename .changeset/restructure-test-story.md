---
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/test-story` depends on `@shivaedev/test-sql`, so an application's one test dependency brings `@shivaedev/test` and `@shivaedev/test-sql`. It forwards `@effect/sql-pg`, which `@shivaedev/test-sql` needs, as an optional peer.
