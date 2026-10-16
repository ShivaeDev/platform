### Added

- Serve the same NDJSON RPC over `<dir>/board.sock` alongside the browser's TCP listener. Each directory has its own socket with owner-only access from creation; serialized startup replaces stale sockets and refuses a live or starting board, and shutdown removes the socket, including SIGINT and SIGTERM.
- Add the `work-board.server` query returning `{ url, directory }` with the board's browser URL and absolute board directory on both transports. Export its `Server` schema from `@shivaedev/work-board/rpc/Server.ts`.
