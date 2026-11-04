---
"@shivaedev/sql": minor
---

### Added

- Repositories expose `findOne` with model-derived filters, ordering and projections, returning `Option` for a matching decoded row.
- `compositeRecordKey` encodes decoded model key fields into the record key published by repository writes, including `NumberFromString` and bigint keys.
