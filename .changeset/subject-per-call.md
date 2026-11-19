---
"@shivaedev/contract": minor
"@shivaedev/identity": minor
---

### Added

- `@shivaedev/contract`: a bound query's options take `subject`, and a query's, command's or stream's `run` takes `{ subject }` as its second argument, so one client and its one socket, including a browser's or Capacitor app's first-frame bearer socket, act for the actor and any number of delegated subjects at once. `subjectHeader.ts` exports `subjectHeader`, `withSubject` and `subjectSerializationKey`.
- `@shivaedev/identity`: the subject guard reads `x-platform-subject` from each call's own RPC message and falls back to the transport header, so existing Node clients that set it on the WebSocket upgrade keep working. It reads no other header from the message; the session, Origin, cookies and authorization stay bound to the transport.

### Fixed

- `@shivaedev/contract`: two bound queries with different subjects and the same `serializationKey` now serialize under separate keys, so SSR hydration no longer gives one subject's result to the other.
