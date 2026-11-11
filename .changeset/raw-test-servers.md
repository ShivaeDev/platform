---
"@shivaedev/quality": minor
---

### Added

- `tests/raw-servers` reports a `test-support/` module that creates a `node:http`, `node:https` or `node:net` server and listens on a port itself, including a free-port probe. Hand a Node HTTP server to `loopbackServer` from `@shivaedev/test-story/server/adapters/loopback.ts`, which listens on a loopback port and closes it with the story's scope, or fake an outside HTTP API with `fakeHttpService` from `@shivaedev/test-story/server/fakeHttpService.ts`. Servers listening on a Unix socket path and `node:net` servers that handle their own sockets are accepted.
