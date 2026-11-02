---
"@shivaedev/contract": patch
"@shivaedev/server": minor
"@shivaedev/create-app": patch
---

### Fixed

- `@shivaedev/contract`: Schedule contract live hints through the Effect runtime's Scheduler, preserving batched changes, resyncs and stream cleanup. Isolate synchronous client identity and activity bridges in adapters and share atom wrapping across bindings.
- `@shivaedev/create-app`: Supply the Crypto layer in generated applications' standalone migration entry point.
- `@shivaedev/server`: Hash the server's default PostgreSQL changes channel through Effect Crypto while retaining its channel name and explicit channel override.

### Breaking

- `@shivaedev/server`: Direct users of `appDatabase` must provide `Crypto.Crypto` for the default changes channel, for example with `Layer.provide(NodeCrypto.layer)` from `@effect/platform-node/NodeCrypto`. `appHost` and `workerHost` already supply it.
