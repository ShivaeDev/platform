---
"@shivaedev/contract": minor
"@shivaedev/server": minor
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Added

- Contract exposes `LiveServer` through `defineService`, with a native `.layer` requiring Reactivity. Its `stream` and `subscribe` methods return Effects containing native Streams, retaining subscription failures and caller requirements.

### Breaking

- Server's `AppChanges` is replaced by `LiveServer` from `@shivaedev/contract/LiveServer.ts`. Replace `AppChanges` imports and requirements with `LiveServer` (use `Context.Service.Identifier<typeof LiveServer>` for its identifier type). PostgreSQL `appHost` and `appDatabase` provide it automatically; HTTP-only apps provide `LiveServer.layer` with Reactivity instead of `Layer.effect(AppChanges, makeLiveServer)`. Call `resync()` instead of reading `resync`, and use `Stream.unwrap` around the Effects returned by `stream` and `subscribe`.
- Server composition helpers (`appHostHttp`, `migratedHost`, `deferredHost`, `hostRpcRoutes` and `hostChanges`) resolve the contract service directly. Remove their live-service tag argument; calls to the former `databaseLayer(options, tag)` become `appDatabase(options)`.
- Work Board's `publishChanges` and Work Fleet's `daemonSnapshots` now require contract's `LiveServer` instead of server's `AppChanges`. Custom compositions must provide `LiveServer.layer` with Reactivity; their standard hosts already do so.
- Import server's `appDatabase` and `DatabaseConfig` directly from `@shivaedev/server/appDatabase.ts`; `appHost.ts` no longer forwards `appDatabase`, and `databaseLayer.ts` is removed.
