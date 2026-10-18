---
"@shivaedev/quality": minor
---

### Added

- Enforce story boundaries: queue and Better Auth SQL ownership, expectations outside test-support, helpers outside specs, an allowlist of public modules for test-support, HTTP error translation at named edge modules, named numeric expectations and stories independent of implementation caps. Configure `boundaries/auth-sql.options.owners`, `boundaries/http-status.options.edge` and `tests/support-imports.options.modules` with repository paths or glob patterns.
