---
"@shivaedev/effect-pg-boss": minor
---

### Added

- `expireIn(queue, duration)` on the testing controller gives subsequently sent jobs a time budget using an Effect duration.

### Fixed

- A job interrupted at its deadline no longer stops its worker from fetching its retry. Interrupted batches return successfully after pg-boss settles their claims. Settlement reads back off and stop one second after the latest fetched deadline; if settlement cannot be observed, the callback fails with a logged `PgBossError` (`operation: "settle"`).
