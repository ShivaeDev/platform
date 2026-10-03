# Native RPC contracts

Effect's `Rpc`, `RpcGroup`, and `AtomRpc` share one Schema contract between typed
handlers and clients. This guide shows them directly. Applications can declare
the same contracts with [`@shivaedev/effect-contract`](../../packages/effect-contract/README.md),
which produces these native definitions and adds typed rejections and
reactivity keys; the order example uses it. Handlers, middleware and clients
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

- [Contract round trips](../../packages/effect-contract/test/contract.test.ts):
  declared operations return handler results and preserve rejections through a
  native client; middleware can deny a request.
- [Public error round trips](../../packages/platform/test/errors.test.ts):
  taxonomy errors cross native RPC JSON as decoded instances with their fields.
- [Compile assertions](../../packages/platform/test/native-rpc.typecheck.test.ts): the
  generated client preserves success and error types; incorrect payloads,
  undeclared methods, missing handlers, incorrect handler results and undeclared
  failures are rejected by TypeScript.

The contract tests use the in-memory transport. Error tests include JSON
serialization. Neither establishes production cancellation or reconnection;
a deployed host requires its own verification.

## Application boundaries

Applications choose their host transport, credentials and reconnection policy.
The shared invalidation declarations live in `@shivaedev/effect-contract`;
`transact` in `@shivaedev/effect-sql` publishes invalidations only after commit.
See the [roadmap](./roadmap.md) for remaining framework work. Native RPC and
reactivity exports remain version-sensitive in the pinned Effect release.
