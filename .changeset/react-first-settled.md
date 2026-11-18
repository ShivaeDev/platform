---
"@shivaedev/contract": minor
"@shivaedev/react": minor
---

### Added

- `@shivaedev/react`: `useFirstSettled(client)` from `@shivaedev/react/client/adapters/useFirstSettled.ts` tells an application when a session's first screen is ready. It returns `false` until a query mounted on the client has delivered its first success or failure and no mounted query awaits a first result and no command is in flight, then stays `true` for that client through later commands and newly mounted queries. A new session generation whose `connect` makes a new client starts at `false` again, and a client that mounts no query stays at `false`.
- `@shivaedev/contract`: The client activity state carries `firstSettled`, the latch behind that hook, and `clientActivity(client)` exposes it as a native `firstSettled` atom beside `connectionStatus`. Code that builds a `ClientActivityState` value itself adds `firstSettled`.
