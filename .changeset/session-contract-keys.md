---
"@shivaedev/effect-contract": minor
"@shivaedev/work-board": minor
---

### Added

- Declare `keyScope: "session"` on a contract and bind it with `bind(Api, Client, { registry })`. Its query keys, successful-command invalidations, live hints and reconciliation use that session registry's scope. `List` and `Item` retain their shapes and item/list/wildcard semantics; `readKeys`, `invalidationKeys`, `makeLiveServer.stream` and `live` accept contextual scope resolution. Server adapters receive the `KeyScope` annotation and must resolve session scopes from request-local authenticated identity.
- Session-scoped automatic subscriptions track mounted query references per registry and release them when queries unmount or the registry is disposed.

### Breaking

- The reserved `<contract>.$changes` payload is now `{ queries: [{ query: "get", payload: { id: 1 } }] }`, typed and decoded with the contract's declared query payload schemas. Custom clients must replace `{ keys }` with declared query references; payloadless queries use `{ query: "list", payload: undefined }`. Subscription handlers must resolve these references with `queryKeys(Api.declaration.queries, queries)` or the RPC's `ChangesReads` annotation before calling `makeLiveServer.stream`. `changesRpc` now requires both the contract name and its query declarations. No raw-key subscription endpoint remains.

- Board's handoff and response RPC contracts use distinct `work-board-handoffs` and `work-board-responses` namespaces so merging contracts preserves each declared subscription schema. Custom RPC clients must replace the `work-board.` prefix for handoff and response operations with the corresponding namespace; operation names and payloads stay the same.
