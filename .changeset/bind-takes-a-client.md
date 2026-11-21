---
"@shivaedev/contract": minor
---

### Breaking

- `bind` is removed: `makeClient` is the one way to a bound API, so every bound command waits until its change is on the screen. A bound command over an `AtomRpc.Service` the caller built counted as reflected when its reply arrived. Make the client from the contract and pass the transport as `protocol`; a story kit passes the in-memory protocol from `@shivaedev/test-kits` with the same handlers. A kit that read

  ```ts
  class Client extends AtomRpc.Service<Client>()("test/NotesClient", {
  	group: Notes,
  	makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
  	protocol: handlers,
  }) {}
  const api = bind(Notes, Client, { registry });
  ```

  becomes

  ```ts
  const client = makeClient({ notes: Notes }, { protocol: layerMemoryProtocol(Notes).pipe(Layer.provide(handlers)), registry });
  const api = client.api.notes;
  ```

  with `layerMemoryProtocol` from `@shivaedev/test-kits/contract/testing.ts`, or `layerLiveMemoryProtocol(Notes, handlers)` from `@shivaedev/test-kits/contract/liveMemoryProtocol.ts` when the kit lets the live host serve `$changes`. `Client.runtime` becomes `client.runtime`, and an Effect that required `Client` requires `ContractsClient` from `@shivaedev/contract/makeClient.ts`. An HTTP-only client passes `RpcClient.layerProtocolHttp(...)` as `protocol`; its commands count as on the screen at their reply, because no live stream follows them.
- The binding types `Bound`, `BoundQuery`, `BoundCommand`, `BoundStream`, `Failure`, `RunFailure`, `QueryOptions` and `RunOptions` move from `@shivaedev/contract/bind.ts` to `@shivaedev/contract/Bound.ts`: `import type { Bound } from "@shivaedev/contract/bind.ts"` becomes `import type { Bound } from "@shivaedev/contract/Bound.ts"`.
