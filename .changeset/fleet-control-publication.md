---
"@shivaedev/work-fleet": minor
---

### Fixed

- Control commands confirm their recorded outcome without waiting for the generated Board status and health publication. Publication continues in the host scope, and a repeated continuation after a lost acknowledgement cannot launch the worker twice.
- Bulk release confirms the recorded closing responses before provider cleanup finishes, using the same background response handling as answer.

### Added

- `publishAfterBoardPass(publication, backgroundScope?)` accepts a scope for background publication outside a shared Board pass. Publications inside a pass retain their existing batching and completion behavior.
- `releaseItems(host, workIds, background?)` can acknowledge recorded release responses while applying them in the background; its default remains synchronous.
- `statusLayer(root, healthConfig?, background?)` and `hostLayer(host, parts, config?, backgroundPublication?)` let daemon hosts publish in the background and flush on shutdown. Composed layers retain synchronous publication by default.
