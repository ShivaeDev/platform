---
"@shivaedev/sql": patch
---

### Fixed

- Refresh matching subscribers when `invalidateOnCommit` receives typed collection keys. List, item and bucket keys use the shared invalidation encoding before commit buffering; arrays may mix typed and raw Reactivity keys, and record-form invalidations retain their behavior.
