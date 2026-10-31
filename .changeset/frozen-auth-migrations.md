---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Generate frozen PostgreSQL auth migration modules containing checked-in SQL with no Better Auth runtime dependency. Check migrated databases against current auth options and report missing tables, fields, indexes, types and nullability changes.
- Generated applications ship frozen auth migrations, retain their Quality configuration, and include a PostgreSQL story that checks their current auth options for drift.

### Fixed

- Execute live auth migration DDL through the native SQL transaction connection, so a preceding migration referencing users cannot block a later auth alteration through another pool.
