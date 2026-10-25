---
"@shivaedev/test-story": minor
---

### Added

- Screen drivers can act on and read screens without a `pending` option. Only `settle()` requires the signal; without it, settlement fails immediately with the typed `MissingScreenPending` error. Drivers that supply `pending` keep `settle()` typed as `Effect<void>`.
