---
"@shivaedev/work-board": minor
"@shivaedev/contract": minor
---

### Added

- `@shivaedev/contract`: Let RPC clients use a native Atom runtime factory so applications and stories can share their Effect services and controlled clocks.

- `@shivaedev/contract`: Expose native dispatcher flushing through `LiveServer.flush()` when a host needs pending live notifications delivered before a following resync.

- `@shivaedev/work-board`: Expose the native Effect agent command so hosts can provide services such as a controlled clock.

### Fixed

- `@shivaedev/work-board`: Run the socket drain period and Codex provider deadline on the native Effect clock so cancellation and timeout share the application's lifecycle and controlled time.

- `@shivaedev/work-board`: Flush pending watcher-state notifications before publishing the following resync.

### Breaking

- `@shivaedev/contract`: Custom `LiveServer` implementations must provide `flush()` returning an Effect that drains pending live notifications. The built-in `LiveServer` layer supplies it through the native dispatcher.
