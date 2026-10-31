---
"@shivaedev/identity": minor
---

### Added

- Auth HTTP spans expose the selected rate-limit address and its peer or trusted-forwarded source as `auth.rate_limit.address` and `auth.rate_limit.address_source`, including counted and refused sign-in attempts.

### Fixed

- A trusted peer without the configured forwarded header falls back to its connection address in development and tests as well as production.
