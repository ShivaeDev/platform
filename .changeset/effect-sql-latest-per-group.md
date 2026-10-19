---
"@shivaedev/effect-sql": minor
---

### Added

- Repositories expose `latestPerGroup({ partitionBy, orderBy, limit, where })` to read up to N rows per group in one statement, with typed filters applied before ranking and Schema-decoded results. `LatestPerGroup` and the existing `OrderBy` type are exported from `repository.ts`; the ordered sort keys include the caller's stable tie-break column.
