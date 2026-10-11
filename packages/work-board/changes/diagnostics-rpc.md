### Changed

- Diagnostics now reads health, owner waiting counts and rate-limit observations through the Fleet daemon HTTP RPC API, with explicit stopped-daemon state, retry on refresh and preserved health freshness.
- Add `BoardOptions.fleetPort`, the `--fleet-port` CLI option, the `daemonDiagnostics(port)` client, and the shared `DiagnosticsContract`, `DiagnosticsSnapshot`, `DAEMON_PORT` and `DAEMON_RPC_PATH` definitions for the daemon query.
