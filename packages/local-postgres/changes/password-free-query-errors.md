### Fixed

- PostgreSQL setup query errors no longer expose connection passwords from userinfo or query parameters through host or Docker client commands, while preserving diagnostics and the original error as `cause`.
