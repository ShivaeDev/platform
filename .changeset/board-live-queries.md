---
"@shivaedev/work-board": minor
"@shivaedev/contract": minor
"@shivaedev/test-story": minor
---

### Changed

- Work Board file edits refresh authorized contract queries over Platform's shared WebSocket, including the Claude plugin's overview. Unrelated document reads retain their values.
- Forwarding proxy fixtures can disconnect and resume real client traffic at the same address.
- DOM story environments use the Node platform WebSocket constructor for server-side clients alongside browser document sockets.
- Automatic contract live connections expose a `paused` atom; resuming reconciles their mounted queries. Bindings can supply a `resumeWindow` for embedded browser lifecycle events.

### Breaking

- Work Board removes its `subscribe` RPC. Consumers bind its contract queries with Platform's default WebSocket client instead of consuming Board-specific change hints.

- `WorkspaceConfig.indexing` supplies a progress snapshot Effect. Replace indexing Stream overrides with an Effect that reads current progress.
