---
"@shivaedev/effect-github": minor
---

### Added

- Authenticate GitHub REST requests as an App installation with built-in RS256 signing, repository installation lookup, and cached installation tokens shared across concurrent requests until their refresh point.
- Verify webhook signatures against raw bytes with HMAC SHA-256 and a constant-time comparison before decoding the delivery with the caller's Schema. Signature and App authentication failures stay typed and exclude credentials from errors and telemetry.

### Breaking

- `GitHubToken` may now contain a lazy Effect as well as a static Option. Consumers reading the service directly must resolve it with `Effect.isEffect(value) ? yield* value : value` before inspecting the Option. Existing `Layer.succeed(GitHubToken)` providers and `GitHubToken.fromEnv` need no changes.
