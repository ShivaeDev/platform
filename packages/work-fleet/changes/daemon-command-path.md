### Added

- `work-fleet decide <work-id> retry|release` answers the current published Fleet decision through the daemon without looking up question or response IDs. The daemon contract adds `daemon.decide`, `daemon.release` and `daemon.name-threads`; host helpers expose scoped `daemonRequest`, `decideWork`, `releaseItems`, `withDecisionResponses`, `recordDecisionResponse` and `nameStoredThreads` for this path.
- `host/actionCommands.ts` exports the native CLI definitions `continueCommand`, `releaseCommand`, `reassignCommand`, `nameThreadsCommand` and `decideCommand` for subcommand composition.

### Changed

- `release`, `reassign`, `continue` and `name-threads` use the running daemon and accept `--port`, sharing its runtime instead of connecting to PostgreSQL from the CLI. Client `--board` and `--config` flags do not select a host. Thread naming returns rename and failure messages to the caller.
- `pg` is a test dependency. Read-only test connection setup lives in test support; daemon status reads use `recordPayloads`.
