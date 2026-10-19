---
"@shivaedev/effect-contract": minor
---

### Added

- Contracts include their reserved `<namespace>.$changes` stream in native RPC client types, with the same middleware as declared operations. Subscribe through a client typed from the contract without a cast or a separate Changes group.

### Breaking

- Native contract handler builders now require the reserved `$changes` handler. When a Platform host supplies it, build application handlers with `contract.omit("<namespace>.$changes").of(...)` and `.toLayer(...)`, while retaining the full contract for the host and client. Standalone servers and test clients must supply a changes stream handler. Remove hand-built Changes groups and use the contract directly.
