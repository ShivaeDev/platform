---
"@shivaedev/work-board": patch
---

### Fixed

- Install the workspace removal watch before the recursive watch, and wait for both to buffer native events before reporting the workspace as watched, including when the root cannot accept a readiness sentinel.
