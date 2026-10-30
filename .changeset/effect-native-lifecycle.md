---
"@shivaedev/http": minor
"@shivaedev/sql": minor
---

### Changed

- Require the Effect 4.0.6 stack.

### Fixed

- Publish committed SQL invalidations immediately for their owning database, including when another database has an open transaction.

### Breaking

- `@shivaedev/sql`: migration-body SQL failures now propagate as native typed `MigrationError` failures. Handle them with `Effect.catchTag("MigrationError", ...)` instead of defect recovery; migration-body defects remain defects.
- `@shivaedev/http`: bounded request-body reads use the native reader and its connection cleanup. Do not assume a rejected upload can drain an arbitrarily large unread body and reuse its connection; allow the HTTP client to open a new connection. The optional Node platform peer is no longer required by this package.
