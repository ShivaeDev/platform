---
"@shivaedev/test-story": minor
---

### Added

- `browserReads` exposes `heardKeys()` with every key from received change hints, preserving delivery order and repeats across session sockets.
- `domFetch` exposes a native `pending` stream on the returned fetch so screen drivers can wait for all document requests, including overlapping calls and cancellation.
