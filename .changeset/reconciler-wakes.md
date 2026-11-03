---
"@shivaedev/reconciler": minor
---

### Added

- Run scoped background reconciliation at startup, on changes keys or at a reported due time, with merged pending wakes and no polling interval.
- Supervise failures independently with readable state, typed termination, resume and optional application-owned failure persistence.
- Run keyed actions once while each key remains present, interrupting removed work and isolating child failures.
