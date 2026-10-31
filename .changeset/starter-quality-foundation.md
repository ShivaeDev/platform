---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- `migrateBetterAuth` runs Better Auth schema migrations using the database from Effect's SQL service. Applications pass auth configuration without a database pool.

### Fixed

- Generated applications start with no quality baseline and rely on the jobs package’s peer installation of `pg-boss`.
