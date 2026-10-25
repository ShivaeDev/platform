---
"@shivaedev/platform": minor
---

### Added

- Opt in to signed Better Auth bearer sessions for bundled native clients through the auth host mount. Browser responses retain HttpOnly cookies without exposing credentials; cookies take precedence over bearer headers. Sign-out and native session replacement revoke the old credential and end its live subscriptions on revalidation.
