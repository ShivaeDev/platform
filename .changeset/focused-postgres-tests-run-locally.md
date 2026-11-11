---
"@shivaedev/test-sql": minor
---

### Added

- `postgresTestUrl` falls back to the local `platform_test_<name>` database for a `PLATFORM_<NAME>_TEST_DATABASE_URL` variable that is not set, so a focused test run needs no setup. Other variable names and the `CI` refusal are unchanged.
