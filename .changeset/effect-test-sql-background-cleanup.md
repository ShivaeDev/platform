---
"@shivaedev/effect-test-sql": minor
---

### Added

- `PostgresTestDatabase.awaitCleanup`, a native `Effect<void>` that waits for already-queued drops and preserves cleanup failures as SQL defects.

### Changed

- Drop isolated databases in the background and await outstanding cleanup when the PostgreSQL test layer closes.

### Fixed

- Retry database drops when PostgreSQL's connection budget is exhausted, and sweep abandoned local test databases at startup. Permanent cleanup failures still surface as SQL defects when the layer closes.
