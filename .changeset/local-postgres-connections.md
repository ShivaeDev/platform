---
"@shivaedev/local-postgres": patch
---

### Changed

- The shared development PostgreSQL container now allows 500 connections. Existing containers are raised on their next start, preserving their data; containers already allowing 500 or more connections are left running unchanged.
- Setting failures throw `PostgresSettingError` from `localConnections.ts`, identifying the container and `max_connections` setting. The lower-level `ensureConnections(docker, sql, ready)` function applies and verifies the setting through the existing synchronous setup API.
