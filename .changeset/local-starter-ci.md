---
"@shivaedev/local-postgres": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/local-postgres`: Allow an explicit list of ports in `assertLocalDatabase` so test configuration can accept a loopback PostgreSQL CI service while shared development setup keeps port 55432 as its default.

### Fixed

- `@shivaedev/create-app`: Generated apps validate their test database through `local-postgres` before running tests, accepting localhost port 5432 and refusing remote hosts and redirecting connection parameters.
