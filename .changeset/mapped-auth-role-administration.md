---
"@shivaedev/identity": minor
"@shivaedev/admin": minor
---

### Added

- Accept the application's Better Auth options in role assignment, provider-account role seeds and admin Users handlers to follow custom table and column mappings. Existing calls retain the default mapping.

### Fixed

- Preserve the configured role column when mounting stored roles, generating role-aware migrations and checking the auth schema.
