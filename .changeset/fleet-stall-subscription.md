---
"@shivaedev/work-fleet": patch
---

### Fixed

- Count worker silence from the current live subscription or later activity, so restarting or reconnecting Fleet gives a busy worker a full stall interval. Stalled workers can keep waiting with a fresh interval, and new activity or completion automatically closes the stall decision and continues their result.
