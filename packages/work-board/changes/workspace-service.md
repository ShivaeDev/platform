### Breaking

- Replace `responses.ResponseConfig` and the `ResponseOptions` type in `integration/responses.ts` with `responses.Workspace`, `responses.WorkspaceConfig` and `WorkspaceOptions`. Provide `Workspace.layer` to `Responses.layer`, configured with the root, watcher, typed index, optional home and explicit `writable` choice.
- Workspace-backed server helpers now require the declared workspace service: `boardServices` composes services and handlers, `handlers` accepts only transport options, `projectionQueries` and `remainingQueries` are Effects that read the workspace, `hints()` reads it directly, and `fleetItems` accepts only the daemon port. `readDocument` takes workspace settings and a snapshot instead of `DocumentOptions`; `ResponseConfig` and `ResponseOptions` are removed; import `Responses` through `integration/responses.ts` instead of the removed `responses/service.ts` module. `readingActions` accepts the question locator directly.

### Fixed

- Fleet items declares `InternalServerError` for unexpected index defects instead of returning an unavailable projection. Typed index failures still report unavailable documents.
