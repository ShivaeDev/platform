---
"@shivaedev/contract": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/contract`: Hold unsent bound commands for up to ten seconds while the client reconnects, including with supplied native socket protocols. Report `waiting-for-connection` immediately through client activity and React's connection status hook; a connection timeout remains a typed `RpcClientError`.
- `@shivaedev/contract`: Probe an open default socket with RPC Ping/Pong on visible visibility, online and pageshow events or native resume. Reconnect after 2.5 seconds without a Pong, holding commands during the probe without replaying requests already sent.
- `@shivaedev/react`: Expose the immediate `waiting-for-connection` status through `useConnectionStatus` while a bound command waits, keeping actions pending until delivery or the typed connection timeout.

- `@shivaedev/contract`: Add `SocketClock`, a native Clock reference for controlling the default client’s network deadlines independently of application timers. Network time remains real by default.

### Breaking

- `@shivaedev/contract`: `ConnectionStatus` includes `waiting-for-connection`. Handle this case alongside `reconnecting` in exhaustive status rendering. Custom `ResumeWindow` implementations must also accept `pageshow` events.
- `@shivaedev/react`: `useConnectionStatus` can return `waiting-for-connection`. Render it as a reconnect notice while the action remains pending.
