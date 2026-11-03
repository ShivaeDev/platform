---
"@shivaedev/contract": patch
---

### Fixed

- Consume queued live hints when a held query finishes and starts its pending refresh, preventing a later coalescing timer from issuing a duplicate read.
