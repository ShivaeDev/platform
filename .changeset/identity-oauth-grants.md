---
"@shivaedev/identity": minor
"@shivaedev/mcp": minor
---

### Added

- Identity provides the `OauthGrants` environment service and the `betterAuthOauthGrants` Layer from `@shivaedev/identity/server/better-auth/adapters/oauthGrants.ts`. List client grants, revoke one client or all clients, and resolve admitted subjects with live consent through this service.

### Breaking

- MCP no longer returns `revokeClient` or `revokeAllClients` from `betterAuthMcp`. Read `OauthGrants` from `@shivaedev/identity/server/oauthGrants.ts` in an Effect and call those methods on the service. Provide `betterAuthOauthGrants({ auth: mounted.auth, admitsUser: mounted.admitsUser })` to that Effect and to `betterAuthMcp`; remove the latter's `admitsUser` option. Applications continue to authorize grant management operations.
- The optional `@better-auth/oauth-provider` peer belongs to identity. MCP's Better Auth adapter uses identity's provider edge exports for resource configuration and discovery; core modules still require no optional peers.
