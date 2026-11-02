---
"@shivaedev/test-sql": patch
---

### Fixed

- Keep `migrationSteps().migrateTo` and the starting phase of `migrationUpgrade` at the requested numbered migration without running current-schema components or publishing a release. Full migration runs still apply components and record the configured release through `migratePostgres`.
