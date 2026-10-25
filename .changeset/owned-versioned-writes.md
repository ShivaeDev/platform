---
"@shivaedev/effect-sql": minor
---

### Added

- Versioned repositories accept composite keys so a consumer app can keep ownership and version predicates in one atomic write. `OptimisticConcurrencyError.reason` distinguishes `missing` from `stale` under the full key without exposing stored row data.
- Versioned repositories with `conflictColumns` support `insertOrIgnore`, initializing the version to zero while leaving conflicting rows untouched. Unconditional upserts remain unavailable.
