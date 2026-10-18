### Fixed

- Fleet client commands discover the daemon's bound port from the Board folder's `.fleet-port` file unless `--port` overrides it. The daemon writes the file after binding, including when serving on an automatically assigned port.
- `watch --follow` prints an error on stderr for each failed connection attempt and keeps retrying, rereading the port file after a daemon restart.

### Added

- `host/daemonPort.ts` exports `readDaemonPort(board, override?)` and `publishDaemonPort(board)` Effects. `host/cliOptions.ts` exports `clientPort(input)`, and `FollowOptions` accepts an optional `board` folder for discovery.

### Changed

- The exported CLI `port` flag is optional so an omitted flag allows daemon discovery.
