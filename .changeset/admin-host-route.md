---
"@shivaedev/platform": minor
---

### Added

- `adminRoute(sessions)` guards host route handlers with the session and Origin policy and the admin role, providing request identity and mapping authorization refusals to HTTP responses while preserving handler responses and typed failures.
