---
"@shivaedev/server": patch
"@shivaedev/sql": patch
"@shivaedev/deploy": patch
---

### Fixed

- `@shivaedev/server`: Apply declared `postgresSettings` only on Railway deployments. From server 0.30 through this fix, startup applied settings everywhere, including stories and local development against shared PostgreSQL.
- `@shivaedev/sql`: Gate `applyPostgresSettings` on Railway's nonempty `RAILWAY_REPLICA_ID` and the native PostgreSQL client's destination. Always exclude development port 55432, including URL query-parameter addresses, even when every Railway variable is present. Service variables from `railway run` alone do not enable settings.
- `@shivaedev/deploy`: Clarify that application-owned PostgreSQL settings apply only on Railway deployments and leave shared development PostgreSQL unchanged.
