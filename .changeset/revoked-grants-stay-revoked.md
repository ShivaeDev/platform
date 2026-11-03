---
"@shivaedev/identity": minor
"@shivaedev/mcp": minor
---

### Breaking

- `@shivaedev/mcp`: MCP tokens now carry a `grant_id` that references the exact Better Auth `oauthConsent` row. Tokens issued before this change lack that reference and are refused; clients must authorize again to obtain new access tokens. Existing refresh tokens can obtain grant-bound access tokens while their consent remains live.
- `@shivaedev/identity`: Replace `OauthGrants.resolveSubject(userId, clientId)` with `resolveGrant(grantId, userId, clientId)`, which returns an optional `{ user, scopes }` containing current grant scopes. Custom service implementations must look up the exact grant and verify its user and client. For custom stores, assign each stored grant an immutable unique ID, preserve it when scopes change, and allocate a fresh ID after revocation. Keep existing Better Auth consent rows and their IDs; no database migration is required. Never reuse a deleted grant ID when importing stored grants. Token issuers must include the consent ID as `grant_id`; `betterAuthOauthProvider` and `mcpProvider` do this automatically.

### Fixed

- `@shivaedev/mcp`: Revoked MCP tokens stay refused after new consent. Removing `mcp` from a live grant’s scopes refuses its tokens on the next request.
