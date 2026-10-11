### Added

- Add `work-fleet serve <board-dir> [--port <port>]` and the scoped `daemonLayer` / `serveFleet` host API, with `DAEMON_HOST` and `DAEMON_PORT` defaults. One Fleet host, bounded PostgreSQL pool and provider connection set serve the scheduler and concurrent HTTP RPC clients; closing the daemon releases them. A listener collision fails before scheduling work.
- Expose existing effect-contract Fleet operations through `DaemonContract`, `RPC_PATH` and the `daemonRpc` server Layer at `/_fleet/rpc` over native NDJSON HTTP, with Platform request tracing. Bind to `127.0.0.1:3457` by default and accept only loopback Host values, missing or same-origin transport Origin and NDJSON requests. Restart uses the existing durable launch recovery, retaining uncertain ownership when a thread was not acknowledged.
- Expose `hostScheduler` for scheduling with an already provided host Layer; `runFleet` retains its embedded scheduler behavior.

### Breaking

- Remove the `work-fleet run` CLI command. Use `work-fleet serve` to schedule approved work and expose local HTTP RPC.
