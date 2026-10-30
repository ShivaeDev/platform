---
"@shivaedev/mcp": patch
---

### Fixed

- Return 503 without an OAuth restart challenge when bearer verification cannot reach the JWKS service, and log verification failures with secrets redacted. Invalid and expired tokens still receive 401.
