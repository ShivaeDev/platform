---
"@shivaedev/work-fleet": patch
---

### Fixed

- Coalesce daemon status and health publication behind one background worker and one pending refresh, so repeated reconciliations do not retain an ever-growing queue of publication fibers while a write is delayed. Scheduler and shutdown flushes still publish current state.
