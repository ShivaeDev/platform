---
"@shivaedev/work-fleet": patch
---

### Fixed

- Close stale failed answers for done, released, deferred or dropped work with `close-finished-decisions`, recording why the decision closed and removing it from orchestrator status and watch reports. Failed answers for active work keep waiting on the orchestrator.
