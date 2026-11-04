---
"@shivaedev/identity": patch
---

### Fixed

- Enable native Better Auth database joins by default so interrupted session lookups release PostgreSQL queries without fallback join console errors or account ids. Explicit `advanced.database.joins` options still take precedence.
