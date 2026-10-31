---
"@shivaedev/errors": minor
"@shivaedev/contract": minor
"@shivaedev/server": minor
---

### Added

- `rpcBoundaryHandlers(group, boundary, handlers)` applies one boundary and unexpected mapping to a native RPC handler map, including Effect and Stream handlers and native RPC wrappers.
- Contract changes streams declare `WebSocketRequired` so HTTP clients can decode the protocol error.

### Fixed

- Hosted `$changes` subscriptions over HTTP fail with a message saying they need the WebSocket protocol.
