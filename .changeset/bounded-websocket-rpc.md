---
"@shivaedev/server": patch
---

### Fixed

- Apply the host's `maxBodySize` and `MAX_BODY_SIZE` limit to WebSocket RPC messages, including binary and fragmented messages. Oversized messages close the connection with WebSocket code 1009, surfaced as Effect's typed `SocketError` with a `SocketCloseError` reason.
