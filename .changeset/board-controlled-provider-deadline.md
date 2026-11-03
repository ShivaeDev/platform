---
"@shivaedev/work-board": patch
---

### Fixed

- Run the socket drain period and Codex provider deadline on the native Effect clock so cancellation and timeout share the application's lifecycle and controlled time.
