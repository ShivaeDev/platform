---
"@shivaedev/platform": minor
"@shivaedev/test-story": minor
"@shivaedev/create-app": patch
---

### Added

- Expose test-only Better Auth database readouts and faults for the default auth schema so application stories do not issue SQL against provider-owned tables.

### Fixed

- Generated applications use native named migrations without a default-export exception, provision admin auth fields through Better Auth and start without Quality baseline debt.

### Breaking

- Test-story uses the current catalog peers: Vitest 5.0.4 and happy-dom 21.0.1. Consumers upgrading from the previous release must align those test dependencies; happy-dom remains optional for applications without DOM stories.
