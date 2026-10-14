### Added

- The typed `fleetItems` Board query reads current Fleet stages, waiting owners, PR URLs and persisted times through the Diagnostics daemon client, joins unique Board documents by ID, and returns `unavailable` with a reason for failed reads or a disabled (`fleetPort: null`) daemon. The shared `DiagnosticsContract` adds `daemon.fleetItems`, backed by `FleetItem`, `CompletedFleetItem` and `FleetItems` schemas. `FleetStage` and `FleetTimestamp` are also available through the diagnostics integration. Legacy stage entry and completion times remain unknown until an observed transition.

- `FleetItemsProjection` describes the Board result. The shared `readDaemon(port, read)` transport and `daemonUnavailableReason(error, port)` explanation are available from `diagnostics/daemon.ts`.
