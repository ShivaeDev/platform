---
"@shivaedev/identity": patch
"@shivaedev/server": patch
---

### Fixed

- End open authenticated streams with `AuthUnavailable` when a session revalidation cannot reach the auth provider. Revoked sessions still end with `Unauthorized`, and live-change subscriptions use identity's shared stream revalidation.
