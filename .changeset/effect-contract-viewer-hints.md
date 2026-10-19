---
"@shivaedev/effect-contract": minor
---

### Added

- `authorizeReads(effect, request, policy, denied)` and `ReadPolicy` in `readPolicy.ts` share a key authorization policy between query reads and live hints. `QueryReads` in `serverMetadata.ts` exposes the declared query read keys to server middleware.
- `changesRpc(name)` retains the literal contract name for typed native clients.

### Fixed

- Live streams filter changed keys with the viewer's read policy and suppress empty hints, while preserving independently allowed list hints.
