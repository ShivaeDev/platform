---
"@shivaedev/access": patch
"@shivaedev/admin": patch
"@shivaedev/changes": patch
"@shivaedev/contract": patch
"@shivaedev/create-app": patch
"@shivaedev/errors": patch
"@shivaedev/form": patch
"@shivaedev/github": patch
"@shivaedev/heavy-lock": patch
"@shivaedev/identity": patch
"@shivaedev/jobs": patch
"@shivaedev/mcp": patch
"@shivaedev/platform": patch
"@shivaedev/pr-watch": patch
"@shivaedev/quality": patch
"@shivaedev/react": patch
"@shivaedev/releases": patch
"@shivaedev/server": patch
"@shivaedev/service": patch
"@shivaedev/skills": patch
"@shivaedev/test": patch
"@shivaedev/test-sql": patch
"@shivaedev/test-story": patch
"@shivaedev/vitest-rerun": patch
"@shivaedev/webhooks": patch
"@shivaedev/work-board": patch
"@shivaedev/work-fleet": patch
---

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.
