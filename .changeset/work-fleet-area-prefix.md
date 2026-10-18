---
"@shivaedev/work-fleet": minor
---

### Added

- `work-fleet reserve-pr <url>` reserves a foreign PR through the daemon, using matching Board task areas or repeated `--areas` options. Scheduler observations release closed or merged foreign PR reservations and retain them when GitHub reads fail.
- Foreign reservations expose typed `areas` lists, stored as PostgreSQL `text[]`; `reserveForeign` accepts an optional third `areas` argument.

### Changed

- Area scheduling uses equality, slash-delimited prefixes and `*` overlap for held areas, waiting order and foreign PR reservations. Parent and child areas block each other; sibling areas remain independent.

### Breaking

- Code constructing a `ForeignReservation` value must include an `areas` array; use `[]` for occupancy-only reservations. Existing PostgreSQL reservations migrate with empty areas.
