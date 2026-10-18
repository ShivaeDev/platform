---
"@shivaedev/create-app": patch
---

### Changed

- Generated apps read local database setup configuration inside Effect, use the database names in `DATABASE_URL` and `TEST_DATABASE_URL`, and fail with a typed configuration error when either URL is missing.
