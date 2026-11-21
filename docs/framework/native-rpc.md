# Native RPC contracts

Effect's `Rpc`, `RpcGroup`, and `AtomRpc` share one Schema contract between typed handlers and clients. This guide shows them directly. An application writes its operations as their payload and `run` in a module defined with [`@shivaedev/contract`](../../packages/contract/README.md), as the [feature guide](./add-a-feature.md) shows: the module is a native `RpcGroup` whose handlers it builds itself, and the browser binds a generated contract of the same group. Middleware, transport and clients remain the native components below.

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

Bind application services using `NotesRpc.toLayer(Effect.gen(...))`. The returned handler object is checked against the declared payloads, successes and errors. Handlers return Effects producing ordinary values or declared failures. No application sequence number, event envelope or journal is required. Native RPC still has its own internal transport request identifiers.

Keep domain authorization in services and server middleware. A client-selected query or mutation mode is a cache/UI choice, not a security boundary. Both operations remain ordinary native RPC contracts.

## Client state

The browser reaches a module through a client from `makeClient` in `@shivaedev/contract/makeClient.ts`, made over the module's generated browser contract, and React's hooks read its bound queries and commands. A bound query is live: it reruns on the server when a write announces a key it reads, and the server pushes its new result over the client's shared WebSocket. The browser keeps no reactivity keys and refreshes no query itself, so an application builds no `AtomRpc.Service` of its own. The [contract guide](../../packages/contract/README.md#build-a-shared-websocket-client) shows the client, and the [live-update guide](./live-updates.md) shows the keys a query reads.

## Public client configuration

Use `publicConfig(schema)` from `@shivaedev/contract/publicConfig.ts` and `publicConfigLayer(declaration, path?)` from `@shivaedev/server/rpc-server/publicConfigLayer.ts` as the one path for public server configuration. Declare the public fields once in a shared Schema, merge the generated contract into the host's RPC group, and merge its server Layer into the handlers. The Layer loads the declared fields through native `Config.schema` during startup; missing or invalid required values fail with a typed `ConfigError`. Undeclared server configuration never enters the response.

Read the generated `get` query through a client made with contract's `makeClient` and react's `useQuery` on the existing native atom runtime. No application-written RPC or separate client configuration store is needed. The generated query has no session middleware and can be merged alongside authenticated contracts for use before sign-in. Keep secrets outside the public Schema. The [server README](../../packages/server/README.md#public-client-configuration) shows the shared declaration, host composition and client binding.

## Application boundaries

Applications choose their host transport, credentials and reconnection policy. The shared invalidation declarations live in `@shivaedev/contract`; `transact` in `@shivaedev/sql` publishes invalidations only after commit.
