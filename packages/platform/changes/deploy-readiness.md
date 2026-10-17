### Added

- `appHost` serves unauthenticated `GET /health` with an empty, uncached response: 200 when its database probe succeeds within two seconds, or 503 when SQL is absent, unavailable or times out.
- `appDatabase` and database-backed `appHost` accept `migrations.mode: "check"` to verify required migration IDs and names without applying migrations or creating a ledger. Missing or pending migrations fail startup with native `MigrationError`; the default migration mode is unchanged.
