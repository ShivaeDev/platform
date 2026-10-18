---
"@shivaedev/effect-contract": minor
---

### Added

- Contracts attach command invalidation metadata and a host-served change subscription. `serverMetadata.ts` exports `CommandInvalidation` and `changesRpc(name)` for server adapters.
- Bindings expose the `LiveConnection` symbol from `automaticLive.ts`; React session boundaries mount its `connection` atom and track the binding's query keys. `LiveBound` describes its connection and status atoms; `automaticLive(service, name)` and `ChangesClient` expose the underlying tracked coordination. `live` also accepts a function for `resyncKeys`.

### Fixed

- Live server hints contain only changed keys intersecting the subscription, so one item's change does not refetch unrelated item queries.

### Breaking

- Contracts reserve the `<contract>.$changes` RPC name for automatic subscriptions. Use Platform's database host and NDJSON transport for automatic live queries, and remove application subscription handlers and `live()` mounting when using a React session boundary.
