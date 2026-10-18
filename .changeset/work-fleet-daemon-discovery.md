---
"@shivaedev/work-fleet": minor
---

### Fixed

- Fleet client commands discover the daemon's bound port from the Board folder's `.fleet-port` file unless `--port` overrides it. The daemon writes the file after binding, including when serving on an automatically assigned port.
- On shutdown, the daemon removes `.fleet-port` only if it still holds that daemon's port.
- `watch --follow` prints an error on stderr for each failed connection attempt and keeps retrying, rereading the port file after a daemon restart.
- An explicit `watch --follow --timeout` also bounds initial connection retries, reporting the timeout and exiting with code 4 even when no daemon is reachable.
- Fleet clients fail with a file-specific error when the Board daemon port file cannot be read.
- Status answer hints preserve the selected `--board` and any explicit `--port` override, so the printed command answers the same daemon.

### Added

- `host/daemonPort.ts` exports `readDaemonPort(board, override?)` and `publishDaemonPort(board)` Effects. `host/cliOptions.ts` exports `clientPort(input)`, and `FollowOptions` accepts an optional `board` folder for discovery.

### Breaking

- The exported CLI `port` flag changes from a number to an optional number so an omitted flag allows daemon discovery.
- `renderStatus(current, selection?)` accepts `{ board?: string, port?: number }` instead of a numeric port argument, preserving the caller's daemon selection in answer hints.
