# Changelog

## 0.4.2 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.4.0 - 2026-10-25

### Added

- Render untrusted text as literal Markdown text, code spans and table cells, and build row reports within a UTF-8 byte budget with a count of omitted rows.

## 0.3.0 - 2026-10-25

### Added

- Upsert sticky pull-request comments by hidden marker across comment pages, optionally matching an author login.
- Create check runs for a head SHA and move them through in progress to completed with a conclusion and output through Schema-typed requests and responses.

## 0.2.0 - 2026-10-25

### Added

- Authenticate GitHub REST requests as an App installation with built-in RS256 signing, repository installation lookup, and cached installation tokens shared across concurrent requests until their refresh point.
- Verify webhook signatures against raw bytes with HMAC SHA-256 and a constant-time comparison before decoding the delivery with the caller's Schema. Signature and App authentication failures stay typed and exclude credentials from errors and telemetry.
- GitHub paged reads accept a caller policy before each request and expose the observed resource for a path.

### Breaking

- `GitHubToken` may now contain a lazy Effect as well as a static Option. Consumers reading the service directly must resolve it with `Effect.isEffect(value) ? yield* value : value` before inspecting the Option. Existing `Layer.succeed(GitHubToken)` providers and `GitHubToken.fromEnv` need no changes.

## 0.1.0 - 2026-10-25

### Added

- Share token-authenticated GitHub REST reads and JSON writes through an Effect service, with Schema decoding, lazy Link pagination, bounded bodies, ETag revalidation and per-resource rate-limit observations and UTC retry instants.
