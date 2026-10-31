---
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Added

- Native clients can pass `bearerToken` to `makeClient` to authenticate the shared RPC WebSocket in its first frame, without upgrade headers or credentials in URLs. The server applies its existing session and read policies, closes invalid or expired authentication with code 1008, and closes authenticated bearer sockets when their session is revoked. Native resume reconciles live query values.
