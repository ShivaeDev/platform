---
"@shivaedev/changes": minor
"@shivaedev/sql": patch
---

### Added

- `@shivaedev/changes`: Add `collectionInvalidationKeys` to refresh every list, item and bucket reader of a collection, with optional session scoping. Bucket read dependencies now include the collection wildcard.

### Fixed

- `@shivaedev/sql`: PostgreSQL retention purges refresh item and authorized bucket query results after each committed batch without requiring collection-wide read permission. Batches remain bounded and commit independently, with constant-size refresh hints.
