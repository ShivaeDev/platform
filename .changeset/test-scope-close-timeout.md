---
"@shivaedev/test": patch
---

### Fixed

- Limit per-test scope cleanup after a test timeout to five seconds. A stuck finalizer now fails the test with its scope name and lets the runner continue. Remove duplicate failure logging into the captured test console; Vitest reports the failure.
