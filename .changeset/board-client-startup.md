---
"@shivaedev/work-board": patch
---

### Fixed

- Build browser assets before starting the Board from source so checkout runs serve the current client. Failed pages show RPC error tags and messages, or a reload hint when the browser and server disagree on the response shape.
