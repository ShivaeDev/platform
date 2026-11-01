---
"@shivaedev/sql": minor
---

### Added

- Select `columns` in unversioned repository `update` and `updateVoid` calls to change only those fields by primary key without reading the row first, while publishing committed record and bucket changes.
- Encode PostgreSQL `jsonb` columns and decode their nested values with the `jsonb` schema helper.

### Fixed

- Accept read-back values for native overrideable model fields in repository update inputs, including `Model.DateTimeUpdateFromDate`, so selected rows can be passed back unchanged.
