---
"@shivaedev/work-fleet": patch
---

### Fixed

- Retry failed daemon liveness probes five times in total with exponential backoff before reporting an outage after about 30–35 seconds. Watch keeps probes sequential and stays quiet through a ten-second daemon stall.
