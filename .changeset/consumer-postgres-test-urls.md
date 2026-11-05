---
"@shivaedev/test-sql": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/test-sql`: Replace the fixed-environment `databaseUrl` and `postgres` exports from `@shivaedev/test-sql/server/emptyPostgres.ts` with `emptyPostgres(url)`. Consumers select their URL with `postgresTestUrl(name)`, use its `configured` value for the story kit's `runIf`, and pass the redacted URL to `emptyPostgres`.

### Fixed

- `@shivaedev/create-app`: Generated starter PostgreSQL story kits skip locally when `TEST_DATABASE_URL` is absent or empty and fail collection in CI when it is missing.
