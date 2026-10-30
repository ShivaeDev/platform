---
"@shivaedev/sql": patch
---

### Fixed

- `mapSqlError` maps constraints whose declared names exceed PostgreSQL's 63-byte identifier limit. It matches the name PostgreSQL stores, clipped to 63 bytes at a character boundary, instead of sending those violations to the fallback.
