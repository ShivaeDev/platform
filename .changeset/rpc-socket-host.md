---
"@shivaedev/test-story": minor
---

### Added

- `rpcSocketHost(group, handlers)` from `server/rpcSocketHost.ts` serves an RPC group over a real WebSocket on loopback for live-update stories. A story can drop or pause the open sockets, hold or refuse the next handshakes and wait for each handshake that arrives.
