---
"@shivaedev/quality": minor
"@shivaedev/create-app": minor
---

### Fixed

- Report ambient runtime workarounds in core code: runners over Clock, Config and Random, unsafe clock reads, cryptographic randomness, performance time, process state and scheduling. Entry points, tool configs, adapters and test-support retain their boundary role for these checks.

### Breaking

- Repositories upgrading Quality must repair the newly reported ambient access or record existing adoption debt with `quality baseline write --rule biome/plugin`, then lower it as repairs land.
- `createApp` reads secret bytes from Effect's Crypto service. Applications embedding this Effect must provide `Crypto.Crypto`, for example with `NodeServices.layer` or `NodeCrypto.layer` from `@effect/platform-node`. The create-app command already provides it.
