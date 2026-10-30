---
"@shivaedev/test-story": minor
---

### Added

- Hold a forwarding proxy's connection with `hold()` and restore traffic with `online()`, including shared WebSocket RPC and live updates. `disconnect()` now returns a promise that resolves on the reconnected client's first WebSocket frame after `online()`.

### Breaking

- Replace calls to the forwarding proxy's `resume()` with `online()`. Use the returned `url` on IPv4 loopback instead of connecting to the proxy over IPv6; proxy startup no longer requires IPv6 support.
