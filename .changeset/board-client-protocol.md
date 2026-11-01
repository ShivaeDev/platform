---
"@shivaedev/work-board": minor
---

### Added

- `browserClient` takes a `protocol` option, an Effect RPC client protocol layer that replaces the shared WebSocket, and a `live` option that turns off automatic live queries, so a host without WebSocket can read the Board one request at a time.
