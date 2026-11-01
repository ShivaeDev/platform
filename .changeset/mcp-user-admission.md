---
"@shivaedev/mcp": minor
"@shivaedev/identity": minor
---

### Added

- Identity mounts expose `admitsUser(userId)` to check the current sign-in policy for authenticated users on other transports, without caching rule verdicts.

### Fixed

- Identity checks with a zero recheck interval start an independent rule lookup even while another check for the same account is pending.

### Breaking

- MCP's `betterAuthMcp` requires `admitsUser`. Pass `admitsUser: mounted.admitsUser` from `betterAuthMount` alongside `auth: mounted.auth`. Each MCP request refuses users denied by the identity sign-in policy; existing tokens follow admission changes on the next request.
