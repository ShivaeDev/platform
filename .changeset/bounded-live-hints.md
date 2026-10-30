---
"@shivaedev/contract": patch
---

### Fixed

- Bound each `makeLiveServer` stream to 256 pending hints. On overflow, pending hints collapse into a single `Resync`, so stalled consumers reconcile current query results without accumulating a write backlog.
