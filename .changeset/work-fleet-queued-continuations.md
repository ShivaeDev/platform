---
"@shivaedev/work-fleet": patch
---

### Fixed

- A bounded scheduler pass observes active work before resuming queued continuations, so capacity released during the pass is available to them before the pass returns.
