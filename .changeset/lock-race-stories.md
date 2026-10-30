---
"@shivaedev/test-sql": minor
---

### Added

- `raceWithLock` holds a native PostgreSQL row, table or advisory lock until every competing call is queued, then releases the holder and returns each call's result or typed failure in input order.
