---
"@shivaedev/mcp": minor
---

### Added

- Return `revokeClient(userId, clientId)` and `revokeAllClients(userId)` Effects from `betterAuthMcp` to delete consent and stored access and refresh tokens.
- Allow provider `scopes`, including `offline_access`, and an in-process `jwks` source for token verification.

### Fixed

- Refuse banned users and access tokens whose client consent no longer exists with the MCP unauthorized resource challenge.

### Breaking

- Custom Better Auth wrappers passed to `betterAuthMcp` must expose the native context's adapter as well as its user lookup. Pass the full Better Auth instance. Custom signed tokens must identify their OAuth client and have stored consent for that user and client.
