---
"@shivaedev/contract": minor
---

### Breaking

- Import `LiveServer` from `@shivaedev/contract/live-server/service.ts`. Replace `live.subscribe(subscription, read?)` with `subscribe(subscription, read?)` from `@shivaedev/contract/live-server/subscribe.ts`; replace `LiveServer.layer` with `liveServerLayer` from `@shivaedev/contract/live-server/layer.ts` and provide that one Layer. Unwrap the subscription Effect with `Stream.unwrap`. Reactivity remains bound by the Layer, and policy and query-runner requirements remain on the Stream. The `makeLiveServer` convenience API keeps its existing shape.

### Added

- `LiveServer.register(keys)` returns a scoped registration stream whose read keys can be replaced while it is consumed.
