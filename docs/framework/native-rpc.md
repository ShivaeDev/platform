# Native RPC contracts

Effect's `Rpc`, `RpcGroup`, and `AtomRpc` share one Schema contract between typed
handlers and clients. This guide shows them directly. Applications can declare
the same contracts with [`@shivaedev/effect-contract`](../../packages/effect-contract/README.md),
which produces these native definitions and adds typed rejections and
reactivity keys; the meal example uses it. Handlers, middleware and clients
remain the native components below.

## Ordinary operations

```ts
import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

const Note = Schema.Struct({ id: Schema.String, title: Schema.String });
const MissingNote = Schema.Struct({
  _tag: Schema.Literal("MissingNote"),
  id: Schema.String,
});

export const NotesRpc = RpcGroup.make(
  Rpc.make("get", {
    payload: { id: Schema.String },
    success: Note,
    error: MissingNote,
  }),
  Rpc.make("rename", {
    payload: { id: Schema.String, title: Schema.String },
    success: Note,
    error: MissingNote,
  }),
);
```

Bind application services using `NotesRpc.toLayer(Effect.gen(...))`. The returned
handler object is checked against the declared payloads, successes and errors.
Handlers return Effects producing ordinary values or declared failures. No
application sequence number, event envelope or journal is required. Native RPC
still has its own internal transport request identifiers.

Keep domain authorization in services and server middleware. A client-selected
query or mutation mode is a cache/UI choice, not a security boundary. Both
operations remain ordinary native RPC contracts.

## Client state

Once a host provides an `AtomRpc.Service` named `NotesApi`, consumers can pass its
atoms to Platform's React hooks. The following is an integration sketch; host
and transport assembly are separate work:

```ts
const note = useQuery(
  NotesApi.query("get", { id }, { reactivityKeys: [`notes:${id}`] }),
);
const rename = useAction(NotesApi.mutation("rename"));
```

Native mutation input can include `reactivityKeys: { notes: [id] }`, alongside
its payload. AtomRpc invalidates those keys on successful mutation completion.
Native Reactivity expands a record key into both `"notes"` and `"notes:<id>"`,
on registration as well as invalidation. Register item queries with the precise
array key `` [`notes:${id}`] `` and list queries with `["notes"]`; an item query
registered with `{ notes: [id] }` also refreshes whenever any other note is
invalidated. This
first API keeps cache policy visible at the call site. A shared policy helper
should be added only when real applications establish a repeated requirement.
Invalidation does not automatically broadcast changes to other clients.

## Executable evidence

- [Runtime integration test](../../packages/platform/test/native-rpc.test.ts):
  native `RpcTest` client/server calls use Layer-provided dependencies, return
  ordinary values, preserve declared failures, and observe state changes from
  successful handlers. Rejected mutations leave the observed state unchanged.
- [Compile assertions](../../packages/platform/test/native-rpc.typecheck.ts): the
  generated client preserves success and error types; incorrect payloads,
  undeclared methods, missing handlers, incorrect handler results and undeclared
  failures are rejected by TypeScript.

These tests intentionally use Effect's in-memory **no-serialization** transport.
They prove native composition and inference; they do not prove wire encoding,
HTTP/WebSocket behavior, authentication, request-scoped identity, or production
cancellation/reconnection. The `Owner` service in the runtime test is a fixed
Layer dependency, not an authentication implementation.

## Remaining work

- [ ] Choose and test the web/mobile host transport and serialization layer.
- [ ] Bind authenticated request identity through native RPC middleware.
- [ ] Verify transformed Schema values and errors over actual serialization.
- [ ] Test cancellation, disconnect/reconnect and error presentation through the
      chosen host and React client.
- [x] Add a shared invalidation policy only where consumers demonstrate repeated
      boilerplate; define transaction commit behavior before server-push refresh.
      See `@shivaedev/effect-contract` and `transact` in `@shivaedev/effect-sql`.

The native API was checked against the workspace's pinned Effect
`4.0.0-rc.112`. Its unstable RPC and reactivity exports remain version-sensitive.
