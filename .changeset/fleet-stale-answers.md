---
"@shivaedev/work-fleet": patch
---

### Fixed

- Read the current Board decision before automatically applying an answer, so an obsolete scan cannot attempt a removed or superseded response. Refused answers explain how to resolve the current response or decision.
- Keep failed earlier answer requests out of status and watch reports once Fleet work is done or released.
