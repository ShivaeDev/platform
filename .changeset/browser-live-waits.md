---
"@shivaedev/browser-check": patch
---

### Fixed

- Failed or interrupted live-notes checks handle pending WebSocket waits without unhandled rejections. Live verification requires RPC hint chunks and a `notes.list` request instead of matching words in unrelated frames.
