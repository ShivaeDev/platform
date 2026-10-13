### Breaking

- Removed `listenOn` from `@shivaedev/work-board/serve.ts` and the `server` and `ServerOptions` exports from `@shivaedev/work-board/rpc/server.ts`. Use `serveBoard` from `@shivaedev/work-board/serve.ts` to run the loopback Board HTTP and RPC server through Platform's `appHost`; the port, routes and CLI flags stay the same.
