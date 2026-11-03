---
"@shivaedev/local-postgres": minor
---

### Added

- App-owned PostgreSQL instances initialize and preserve application data, run as scoped children with private Unix sockets and no TCP listener, and refuse incompatible data major versions with `AppPostgresVersionMismatch`.
- Migration Effects run after a `pg_dump` backup, with configurable retention of completed backups. `PostgresBinaries` separates binary sourcing from lifecycle management; `hostPostgresBinaries` supplies host-installed executables.
