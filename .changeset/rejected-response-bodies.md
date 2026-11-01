---
"@shivaedev/http": patch
"@shivaedev/github": patch
---

### Fixed

- Release response bodies before returning status or body-size failures, and keep schema failures from holding HTTP connections.
- Release GitHub response bodies on rejection and before refreshing a rejected installation token, so repeated failures do not exhaust the connection pool.
