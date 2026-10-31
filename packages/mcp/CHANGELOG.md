# Changelog

## 0.1.9 - 2026-10-31

### Changed

- Update `@shivaedev/identity` from 0.10.0 to 0.10.1.

## 0.1.8 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.

## 0.1.7 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.6 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.5 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.4 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.3 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.2 - 2026-10-30

### Changed

- Release with updated workspace dependencies.

## 0.1.1 - 2026-10-30

### Fixed

- Return 503 without an OAuth restart challenge when bearer verification cannot reach the JWKS service, and log verification failures with secrets redacted. Invalid and expired tokens still receive 401.

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
