### Breaking

- Remove `runFleet`, `continueWork` and `dispatchWork` from `host/commands.ts`, and remove `host/reassignWork.ts` and its `reassignWork` export. Run the host with `serveFleet` from `host/daemon.ts`.
- Remove the `renderStatus` pass-through from `host/status.ts`; import it directly from `host/renderStatus.ts`. Import `fleetStatus` from `host/fleetStatus.ts` after the module rename.
