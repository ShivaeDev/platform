### Changed

- Extend `DaemonContract` with `daemon.diagnostics` on the existing daemon RPC endpoint, with in-memory health observations and shared one-minute Codex/GitHub rate-limit caching. The `host/daemonDiagnostics.ts` handler Layer supplies this query.
- Add `HealthSnapshot` to the services provided by `statusLayer`; health remains available to RPC clients when its file is missing or publication fails.
