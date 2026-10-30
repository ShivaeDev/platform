---
"@shivaedev/errors": minor
"@shivaedev/server": minor
---

### Added

- `@shivaedev/errors/taxonomy.ts` exports class guards (`isConflict`, `isNotFound` and one `is<Class>` guard for every other taxonomy error). They narrow actual class instances and reject objects with matching tags.

### Fixed

- Logs, error reports, RPC failure data and exported spans share errors' database-key and URL policy. Database users and connection strings are masked under their diagnostic keys; URL user information, query values and fragments are masked in structured values and text.

### Breaking

- Import `schemaSensitiveKeys` from `@shivaedev/errors/schemaSensitiveKeys.ts` instead of server, and `redactRecord` from `@shivaedev/errors/redact.ts` instead of server's `redactingDiagnostics.ts`.
- Replace server's `redactOtlpUrl` with `redactUrl` from `@shivaedev/errors/sensitive.ts`. Replace server's `redactOtlpText(value, key, sensitive)` with `redactText(value, sensitive, undefined, key)` from `@shivaedev/errors/sensitive.ts`.
- Errors' redaction helpers now apply the same URL and database-key masking previously applied only to exported traces. Consumers should expect `<redacted>` for URL user information, query values and fragments, and for `db.user`, `db.user.name` and `db.connection_string` values.
