---
"@shivaedev/work-board": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/contract`: Let RPC clients use a native Atom runtime factory so applications and stories can share their Effect services and controlled clocks.

- `@shivaedev/work-board`: Expose the native Effect agent command so hosts can provide services such as a controlled clock.

### Fixed

- `@shivaedev/work-board`: Run the socket drain period and Codex provider deadline on the native Effect clock so cancellation and timeout share the application's lifecycle and controlled time.
