---
"@shivaedev/contract": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/react`: `useConnectionStatus(client)` exposes one debounced `live | reconnecting` status across every binding on a client.
- `@shivaedev/contract`: Client activity and its screen signal carry the same shared connection status.
- `@shivaedev/react`: Query state exposes `refusal` separately from RPC transport failures, keeping retained data available during socket recovery. `QueryView` reports refusals through its failure slot while keeping transport causes available on the query.

### Fixed

- `@shivaedev/contract`: Resume signals interrupt live retry backoff and reconnect immediately, resetting the next retry delay.

### Breaking

- `@shivaedev/react`: `QueryView` calls its failure renderer only for refusals. Read `query.cause` for transport diagnostics and use the client connection status for a shared reconnecting notice.
