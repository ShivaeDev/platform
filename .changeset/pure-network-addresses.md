---
"@shivaedev/quality": patch
---

### Fixed

- Allow pure unit tests to import `BlockList` and `isIP` from `node:net` for in-memory address normalization. Socket and server operations still require stories.
