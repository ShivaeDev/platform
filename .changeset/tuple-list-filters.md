---
"@shivaedev/effect-sql": minor
---

### Added

- Match several model fields together with `tupleIn(model, fields, tuples)` in `findMany`, `select` and unversioned `delete` filters. Tuples use each field's decoded type and codec, combine with other filters, and bind large lists as parameters. An empty tuple list matches nothing.
