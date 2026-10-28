---
"@shivaedev/server": minor
"@shivaedev/test-story": minor
"@shivaedev/quality": minor
---

### Added

- The application host provides Effect's native Crypto service during preflight and deferred construction as well as in application handlers, so commands can generate secure invite codes without ambient randomness.
- Story kits provide native TestCrypto with a fresh seed of 0 for each story, making generated invite codes reproducible. The application’s @effect/platform-node peer supplies its digest implementation.
- Ambient-randomness findings name Effect's Crypto service for secure values and Random for non-secure values.
