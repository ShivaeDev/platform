---
"@shivaedev/jobs": patch
---

### Fixed

- Bound worker shutdown drain by `stop.timeout` (30 seconds by default). Workers drain concurrently, interrupt in-flight Effects at the timeout and log a warning for each registration that times out. Work that finishes within the timeout completes normally.
