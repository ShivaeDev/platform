---
"@shivaedev/sql": minor
---

### Added

- `keysetPage` supplies native SQL seek and ordering fragments, validates positive integer page sizes, and returns rows with an optional continuation from one row of lookahead. Callers supply a unique tie-breaker, predicates, result decoding and cursor values, including exact PostgreSQL timestamp text for microsecond continuation.
