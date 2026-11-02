---
"@shivaedev/contract": minor
"@shivaedev/server": patch
---

### Added

- `@shivaedev/contract`: Derive custom subscription handlers with `changesHandlerLayer`, retaining query payloads, declared failures, read-policy services and stream requirements in a native Layer.

### Fixed

- `@shivaedev/server`: Build hosted changes handlers through the contract Layer and validate pushed results as decoded values, including transformed schemas such as bigint.
