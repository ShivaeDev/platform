# Changelog

## 0.1.0 - 2026-10-30

### Added

- Serve native Effect toolkits on the application host with request identity and permission-based audiences through `@shivaedev/mcp`.
- Connect MCP clients through Better Auth OAuth, with protected-resource discovery and authorization challenges. Install the optional OAuth provider peer to use the edge adapter.

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.
