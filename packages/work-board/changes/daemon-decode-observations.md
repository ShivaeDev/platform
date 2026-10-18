### Added

- Export `DaemonReadContract` from `diagnostics/daemonContract.ts`, accepting unknown diagnostics payloads while retaining the typed Fleet items query for independent source validation.

### Fixed

- Keep System usable when a Fleet daemon diagnostics source has an incompatible shape: show that source's decode error while retaining valid Codex usage, GitHub limits and Fleet health observations.
