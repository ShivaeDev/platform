---
"@shivaedev/sql": patch
---

### Fixed

- Allow interrupted transactions to stop waiting for a pooled connection while preserving announcements for commits that land during interruption.
