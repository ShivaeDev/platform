---
"@shivaedev/test-sql": minor
---

### Added

- Export `postgresTestUrl(name)` from `server/adapters/postgresTestUrl.ts` to share PostgreSQL test collection gates. It returns `{ url, configured }`, treats absent and empty URLs as missing, and refuses missing URLs when `CI` is nonempty.

### Breaking

- `emptyPostgres` now refuses collection in CI without `PLATFORM_SQL_TEST_DATABASE_URL` and treats an empty URL as missing locally. Supply a nonempty PostgreSQL test URL in CI; use `postgresTestUrl(name).configured` for other PostgreSQL story gates.
