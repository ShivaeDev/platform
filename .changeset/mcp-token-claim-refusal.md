---
"@shivaedev/mcp": minor
---

### Added

- Expose `authenticate` from `betterAuthMcp` so applications can distinguish an `InvalidTokenClaim` failure, with its claim name, from a refused OAuth grant. Missing or malformed required claims produce a claim diagnostic; MCP HTTP requests keep their unauthorized resource challenge.

### Breaking

- The exported `bearer` verifier now fails with `InvalidTokenClaim` for missing or invalid claims instead of returning `Option.none()`. Consumers of this verifier must handle the typed failure and can read its `claim` field. The session Layer continues to answer these tokens with the unauthorized resource challenge.
