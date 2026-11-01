---
"@shivaedev/heavy-lock": minor
---

### Changed

- Generate lock IDs through Effect's Crypto service and read process metadata and signals through runtime adapters.

### Breaking

- Acquisition now requires `Crypto.Crypto` alongside the filesystem, path and process-spawning services. Provide `NodeServices.layer`, or add `NodeCrypto.layer` to a custom platform layer.
- Import signal helpers from `@shivaedev/heavy-lock/adapters/signals.ts` instead of `@shivaedev/heavy-lock/cli/signals.ts`.
