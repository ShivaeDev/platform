---
"@shivaedev/effect-test-sql": minor
---

### Added

- `PostgresTestOptions` accepts effect-sql's `SqlNameTransforms`, including the options returned by `clientOptions`, for preparation, shared and isolated PostgreSQL clients. Reuse the app's client options without a test-only name mapping.
- `assertModelColumns` uses the current PostgreSQL client's name transforms to compare database columns with model fields and report mismatches in model field names. Calls without a configured mapping retain literal column comparisons.
