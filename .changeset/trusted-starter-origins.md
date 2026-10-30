---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Identity's `trustedOrigins` accepts an optional `sameOrigin: { trustedProxy }` policy using the transport guard's loopback and trusted-proxy authority checks. Session resolution supplies the transport peer address; RPC message headers cannot establish proxy trust.

### Fixed

- Generated apps accept their own forwarded HTTPS RPC requests without `PUBLIC_URL`, while refusing foreign origins. A configured `PUBLIC_URL` remains the explicit RPC origin allowlist.
