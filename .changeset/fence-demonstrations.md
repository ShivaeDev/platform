---
"@shivaedev/quality": patch
---

### Fixed

- Reject fence demonstrations that name files outside the checked tree, including deleted files, and identify the fence, example and missing path. Replace stale paths with existing checked files; use `external()` for external targets.
