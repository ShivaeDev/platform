---
"@shivaedev/effect-test-sql": minor
---

### Added

- Select an empty or migrated database from one test layer with `PostgresTestDatabase.clone(template)` or `withIsolatedDatabase(effect, { template })`. `PostgresTestTemplate` names the choices; migrated clones remain the default. Story traits can choose a template before acquiring their app services.
- Accept a scoped `PostgresTestLoader` callback in `fixtures` that receives the migrated template's redacted URL, so app options can open their own pool during once-per-layer preparation. Existing fixture Effects remain supported.
