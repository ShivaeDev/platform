---
"@shivaedev/quality": minor
"@shivaedev/work-fleet": minor
---

### Added

- `@shivaedev/quality`: Report `rpcBoundary` and `rpcBoundaryHandlers` outside modules that build native RPC handlers, keeping service failures typed until the handler edge.
- `@shivaedev/work-fleet`: Export `fleetFailure` from `operations.ts` for handler registrations' shared error mapping and redacted fallback.

### Breaking

- `@shivaedev/work-fleet`: `exposeFailure` maps typed errors and preserves defects. Import `fleetFailure` from `operations.ts` for the previous handler-edge behavior, or apply `rpcBoundary(FleetError, options)` after `exposeFailure` in the handler module. Fleet and daemon handler registrations retain their existing fallback behavior.
- `@shivaedev/work-fleet`: `daemonHandlers` reads UUIDs through Effect's `Crypto` service. Provide `NodeCrypto.layer` or an application `Crypto` implementation when constructing it; the Fleet runtime already supplies this service.
