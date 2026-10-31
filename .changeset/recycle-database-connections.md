---
"@shivaedev/server": minor
"@shivaedev/sql": minor
"@shivaedev/jobs": minor
---

### Added

- Expose native PostgreSQL `connectionTTL`, `idleTimeout` and `minConnections` through the SQL layer and application host, and `idleTimeoutMillis` and `maxLifetimeSeconds` through the jobs layer.

### Fixed

- Application and jobs pools recycle connections after ten minutes and close idle connections after one minute by default, returning backend memory after heavy queries. Application change listeners renew their reserved connection and resynchronize subscribers across renewal.
