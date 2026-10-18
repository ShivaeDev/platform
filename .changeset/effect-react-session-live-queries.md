---
"@shivaedev/effect-react": minor
---

### Added

- Session boundaries mount automatic live connections on bound contract APIs returned by `connect`, either directly or as properties such as `client.api`. Connections follow the session registry lifetime and query keys. `client/mountLive.ts` also exports `mountLive(registry, client)`, returning the release function for a custom owner.

### Breaking

- `SessionBoundary` now connects live queries automatically when its client contains a contract binding. Remove application `live()` calls and connection mounts; serve the contract through a Platform database host with NDJSON serialization.
