# Native RPC contracts

Effect's `Rpc`, `RpcGroup`, and `AtomRpc` share one Schema contract between typed
handlers and clients. This guide shows them directly. Applications can declare
the same contracts with [`@shivaedev/contract`](../../packages/contract/README.md),
which produces these native definitions and adds typed rejections and
reactivity keys; the starter uses it. Handlers, middleware and clients
remain the native components below.

## Ordinary operations

```ts
import { Effect, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";

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
atoms to Platform's React hooks:

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
invalidated. Invalidation does not automatically broadcast changes to other clients.

## Public client configuration

Use Platform's `publicConfig(schema)` and `publicConfigLayer(declaration, path?)` as the one path for public server configuration. Declare the public fields once in a shared Schema, merge the generated contract into the host's RPC group, and merge its server Layer into the handlers. The Layer loads the declared fields through native `Config.schema` during startup; missing or invalid required values fail with a typed `ConfigError`. Undeclared server configuration never enters the response.

Read the generated `get` query with contract's `bind` and react's `useQuery` on the existing native atom runtime. No application-written RPC or separate client configuration store is needed. The generated query has no session middleware and can be merged alongside authenticated contracts for use before sign-in. Keep secrets outside the public Schema. The [Platform guide](../../packages/server/README.md#public-client-configuration) shows the shared declaration, host composition and client binding.

## Application boundaries

Applications choose their host transport, credentials and reconnection policy.
The shared invalidation declarations live in `@shivaedev/contract`;
`transact` in `@shivaedev/sql` publishes invalidations only after commit.
