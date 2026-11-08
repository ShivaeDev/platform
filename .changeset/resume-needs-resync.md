---
"@shivaedev/contract": patch
---

### Fixed

- `@shivaedev/contract`: `api[LiveConnection].status.needsResync` is now true from a resume until the reopened subscription delivers its first update; `connection` stays unchanged and query results keep reporting nothing pending.
