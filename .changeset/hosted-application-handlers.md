---
"@shivaedev/effect-contract": minor
"@shivaedev/create-app": minor
---

### Added

- Contracts expose `application`, a native RPC group for building application handlers without naming the reserved `$changes` stream. Middleware stays attached, and Platform hosts complete the full contract with the stream handler.
- Generated applications build their handlers through the contract's `application` group.
