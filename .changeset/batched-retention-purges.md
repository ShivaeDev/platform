---
"@shivaedev/sql": minor
---

### Added

- Repositories offer PostgreSQL `deleteBatched` retention purges with independently committed batches, a pause and row cap, one table change hint per batch, and a run lock that skips overlapping purges of the same table.
