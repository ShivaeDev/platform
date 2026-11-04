---
"@shivaedev/server": minor
"@shivaedev/work-board": minor
---

### Added

- `@shivaedev/server`: `appHost` accepts `config.socketPath` for Unix HTTP and WebSocket RPC, alone or beside an explicit TCP `port`. Socket files are published with mode `0600`, stale sockets are reclaimed at startup, and shutdown removes the socket.

### Changed

- `@shivaedev/work-board`: serve `board.sock` through the application host, sharing its routes, request limits and live-query transport. Existing Board plugin and MCP clients keep using the same socket path.

### Breaking

- `@shivaedev/work-board`: remove `server/boardSocket.ts`. Direct callers should configure `appHost` from `@shivaedev/server/appHost.ts` with `config.socketPath`, their RPC group and handlers. `serveBoard` continues to publish `board.sock` for Board plugin and MCP clients.
