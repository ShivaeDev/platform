---
"@shivaedev/identity": minor
---

### Added

- Add the `betterAuthMount` provider-only preset to close email/password, magic-link and Better Auth admin HTTP endpoints, omit provider tokens from account writes and disable cookie caching. Apps can explicitly reopen individual preset endpoints with `enabledPaths`.
