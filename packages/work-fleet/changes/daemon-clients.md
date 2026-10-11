### Breaking

- `status`, `dispatch`, `wait` and `watch` require a running local daemon and accept `--port` (3457 by default). They no longer load host configuration or connect to PostgreSQL; retained `--board` and `--config` flags do not select a daemon. An unavailable daemon exits 1 with startup instructions.
- `WaitOptions` and `WatchOptions` replace `databaseUrl` and `namespace` with optional `port`; `intervalMs` and CLI `--interval` now control reconnect delay. `readWaitStates` uses an existing Effect SQL service, takes namespace-only read options and returns all states when IDs are omitted. `daemonRpc` is now a factory accepting the host configuration.

### Added

- The daemon contract exposes `daemon.status`, `daemon.dispatch` (including approved Board preparation) and one scoped `daemon.follow` stream of compact snapshots. Followers subscribe before the initial read, resync on reconnect and preserve terminal summaries, exit codes and deduplicated watch output.
