---
"@shivaedev/contract": patch
---

### Fixed

- Reject authored queries, commands and streams named `$changes` with a declaration error instead of silently replacing them with the built-in changes stream.
