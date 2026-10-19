---
"@shivaedev/work-board": patch
---

### Fixed

- Native RPC handlers cover the reserved `$changes` stream required by typed contracts. Filesystem change delivery continues through the declared `work-board.subscribe` stream.
