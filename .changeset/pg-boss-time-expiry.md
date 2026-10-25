---
"@shivaedev/effect-pg-boss": minor
---

### Added

- `expireIn(queue, duration)` on the testing controller gives subsequently sent jobs a time budget using an Effect duration.

### Fixed

- A job interrupted at its deadline no longer stops its worker from fetching its retry. Interrupted batches return after pg-boss settles their claims.
