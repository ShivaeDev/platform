---
"@shivaedev/contract": minor
---

### Added

- `layerMemoryProtocol(group)` in `testing.ts` connects `makeClient` to native RPC handlers and middleware in process, including live hints and query refreshes, without a socket or a separate `AtomRpc.Service` per contract.
