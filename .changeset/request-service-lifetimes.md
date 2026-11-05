---
"@shivaedev/server": minor
---

### Added

- Register native Layers in `requestServices` on `AppModule` or `appHost` to build services once per RPC call after identity middleware. Request services reuse global services and keep cached values within the call, including on persistent WebSocket connections.

### Breaking

- `appModules` rejects global service Layers that require request identity or services registered in `requestServices`. Move those Layers from `services` into `requestServices`, leave their global dependencies in `services`, and declare the contract's identity or subject middleware. Handlers yield the registered service without providing its Layer per call.
