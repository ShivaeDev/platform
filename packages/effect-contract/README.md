# @shivaedev/effect-contract

Declare a feature's queries, commands, expected failures and refresh dependencies once. The declarations become native Effect RPC definitions, and a client binding connects their dependency keys to native AtomRpc queries.

## Why you want this

A feature often repeats its inputs, results and errors on both sides of an RPC boundary, then separately wires which views a write should refresh. Those copies are easy to make disagree. Put the boundary and its dependencies together:

```ts
import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";

const notes = collection("notes", Schema.Number);
const List = query("list", { reads: () => [notes.list], success: Schema.Array(Schema.String) });
const Rename = command("rename", {
  payload: { id: Schema.Number, title: Schema.String },
  invalidates: ({ id }) => [notes.item(id)],
});
const Notes = contract("notes", { queries: [List], commands: [Rename] });
```

`Notes` is a native RPC group with `notes.list` and `notes.rename` handlers. When its bound rename call succeeds, the declared item change refreshes the list. An item query for another note keeps its result. Handlers, middleware and transport use Effect's own APIs.

## Using it

### How to think about it

An **operation** describes a boundary, not its implementation: its name, payload schema, success schema and expected failures. A **query** also declares the keys it reads; a **command** declares the keys its successful result changes. A **rejection** is an expected typed failure, such as a missing note or an invalid title. Middleware failures and RPC client failures remain separate parts of the native client's error type.

A **contract** groups operations into a native `RpcGroup`. Its RPC tags are the contract name and operation name joined by a dot. A **binding** connects that declaration to an existing `AtomRpc.Service`: queries get native query atoms and call Effects, while commands get call Effects that invalidate after success.

A **collection key** names a dependency. Its item key identifies one item; its list key identifies a list in that collection. Keys do not hold data. Native query atoms hold results, and native Reactivity asks matching queries to run again.

Optional live hints use those same keys. A hint asks for another read; it does not supply a replacement value, a journal entry or proof that a query is fresh.

### 1. Once per feature: schemas and operations

Keep the shared declaration in a module that both server and client can import:

```ts
import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";

export class Note extends Schema.Class<Note>("Note")({
  body: Schema.String,
  id: Schema.Number,
  title: Schema.String,
}) {}
export const Draft = Schema.Struct({ body: Schema.String, title: Schema.String });
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.Number }) {}
export const notes = collection("notes", Note.fields.id);

export const Get = query("get", {
  payload: { id: Schema.Number },
  success: Note,
  rejections: { NoteMissing },
  reads: ({ id }) => [notes.item(id)],
});
export const List = query("list", {
  success: Schema.Array(Note),
  reads: () => [notes.list],
});
export const Rename = command("rename", {
  payload: { id: Schema.Number, title: Schema.String },
  success: Note,
  rejections: { NoteMissing, Invalid: fieldRejection(Draft, ["title"]) },
  invalidates: ({ id }) => [notes.item(id)],
});
export const Create = command("create", {
  payload: Draft,
  success: Note,
  rejections: { Invalid: fieldRejection(Draft) },
  invalidates: (_draft, note) => [notes.item(note.id)],
});
export const Notes = contract("notes", { queries: [Get, List], commands: [Rename, Create] });
```

Save this module as `notes.ts`. The payload can be struct fields, as in `Get`, or a schema, as in `Create`. An omitted payload or success is `Schema.Void`; no declared rejections gives `Schema.Never`. The `reads` callback receives the decoded payload. `invalidates` receives the decoded payload and successful result, so a create call can invalidate the ID the server assigned.

The collection's ID schema gives `item` its ID type. Here, `notes.item` takes a number. Query and command callbacks retain their payload and result types, including when the operations are declared inline inside `contract`.

Operation names must differ within a contract, including across queries and commands. Literal duplicate declarations fail compilation. If the compiler cannot see the names in an array, contract construction checks them and throws with the duplicated names.

### Expected failures

`rejections: { NoteMissing }` reuses the class. The object's key must equal the class's `_tag`. Sharing a class lets a service and several operations use the same expected failure.

`rejections: { Invalid: fieldRejection(Draft) }` generates a tagged error class for that operation. `fieldRejection` derives the allowed field names from the struct; an explicit field list narrows them. `Rename` permits only `"title"`, while `Create` permits `"body"` or `"title"`. Their generated `Invalid` classes are distinct.

```ts
const invalid = new Rename.Rejection.Invalid({ field: "title", message: "Enter a title" });
const refused = Rename.reject.Invalid({ field: "title", message: "Enter a title" });
const missing = Get.reject.NoteMissing({ id: 9 });
```

`invalid` is the generated class instance. `refused` and `missing` are failed Effects, with the corresponding rejection in their error channel. Each operation also exposes `payload`, `success` and `error`, so another boundary can use its schemas directly. A handler returning an undeclared rejection fails compilation.

### 2. Once per host: native handlers and transport

Implement the contract with native `of` and `toLayer`:

```ts
import { Effect, Ref } from "effect";
import { Create, Get, Note, Notes, Rename } from "./notes.ts";

export const NotesHandlers = Notes.toLayer(Effect.gen(function* () {
  const stored = yield* Ref.make(new Map([
    [1, new Note({ body: "", id: 1, title: "One" })],
    [2, new Note({ body: "", id: 2, title: "Two" })],
  ]));
  const find = (id: number) => Effect.flatMap(Ref.get(stored), (all) => {
    const note = all.get(id);
    return note === undefined ? Get.reject.NoteMissing({ id }) : Effect.succeed(note);
  });
  const save = (note: Note) => Ref.update(stored, (all) => new Map([...all, [note.id, note]])).pipe(Effect.as(note));
  return Notes.of({
    "notes.get": ({ id }) => find(id),
    "notes.list": () => Effect.map(Ref.get(stored), (all) => [...all.values()]),
    "notes.rename": ({ id, title }) => title.trim() === ""
      ? Rename.reject.Invalid({ field: "title", message: "Enter a title" })
      : Effect.flatMap(find(id), (note) => save(new Note({ ...note, title }))),
    "notes.create": (draft) => draft.title === ""
      ? Create.reject.Invalid({ field: "title", message: "Enter a title" })
      : Effect.flatMap(Ref.get(stored), (all) => save(new Note({ id: all.size + 1, ...draft }))),
  });
}));
```

Save this module as `handlers.ts`. This in-memory layer is the same shape as the package's native RPC fixture. An application can put repository and service calls in these handlers. The contract checks handler result and rejection types; it does not implement persistence, authorization or transactions.

Native `.middleware(M)` returns a contract that retains its declarations. For example, a native middleware service can supply request identity:

```ts
import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";
import { Notes } from "./notes.ts";

class Session extends Context.Service<Session, { readonly user: string }>()("app/Session") {}
class Denied extends Schema.TaggedError<Denied>()("Denied", {}) {}
class Guard extends RpcMiddleware.Service<Guard, { provides: Session }>()("app/Guard", { error: Denied }) {}
const SecuredNotes = Notes.middleware(Guard);
```

The host supplies the middleware implementation and request policy. Native middleware failures join the client's failure type. The [`platform` request-context guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/request-context.md) explains the shared identity and server boundary.

For an ordinary HTTP server, compose the contract with native layers:

```ts
import { Layer } from "effect";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { Notes } from "./notes.ts";
import { NotesHandlers } from "./handlers.ts";

export const NotesRoutes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "http" }).pipe(
  Layer.provide([NotesHandlers, RpcSerialization.layerJson]),
);
```

The server host provides `NotesRoutes` to its native HTTP router. In a separate client module, use the same contract:

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Notes } from "./notes.ts";

export class NotesClient extends AtomRpc.Service<NotesClient>()("app/NotesClient", {
  group: Notes,
  protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1:3000/rpc" }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
  ),
}) {}
export const api = bind(Notes, NotesClient);
```

Save the client module as `client.ts`. The [native RPC guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/native-rpc.md) covers hosting; the [order example](https://github.com/ShivaeDev/platform/blob/main/docs/framework/order-example.md) composes handlers, request identity, SQL and a rendered client.

### 3. Every day: read and change

```ts
const one = api.get.query({ id: 1 });
const list = api.list.query();
const readOnce = api.get.run({ id: 1 });
const rename = api.rename.run({ id: 1, title: "Uno" });
```

`one` and `list` are native query atoms. `readOnce` and `rename` are Effects for individual calls. A query's Effect requires `NotesClient`; a command's Effect also requires native `Reactivity`. Commands expose `run`, and have no `query` member.

Mount the atoms and run commands through the service's atom runtime in the same registry:

```ts
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { api, NotesClient } from "./client.ts";

const registry = AtomRegistry.make();
const one = api.get.query({ id: 1 });
const list = api.list.query();
const releaseOne = registry.mount(one);
const releaseList = registry.mount(list);

const renamed = await Effect.runPromise(
  AtomRegistry.getResult(registry, NotesClient.runtime.atom(api.rename.run({ id: 1, title: "Uno" }))),
);

releaseOne();
releaseList();
registry.dispose();
```

The successful rename invalidates note 1 and the list. A rejected rename invalidates neither. Bound queries and commands take the schema's decoded payload type; native clients take its constructor input, which can differ when a field has a constructor default. Result and failure types preserve operation rejections, middleware errors and `RpcClientError`.

The dependency rule is deliberately asymmetric:

| Declared key | Query reads | Successful command invalidates |
| --- | --- | --- |
| `notes.item(1)` | `"notes:1"` | `"notes:1"` and `"notes"` |
| `notes.list` | `"notes"` | `"notes"` |

`readKeys` and `invalidationKeys` produce these native keys and remove duplicates. An item change refreshes that item and its list, preserving other item queries. A list-only invalidation refreshes list queries and leaves item queries alone. These keys match native Reactivity's record-key hashing of `{ notes: [1] }`.

Client invalidation follows RPC success. For server invalidation at the SQL commit boundary, use `transact` from [`effect-sql`](https://github.com/ShivaeDev/platform/tree/main/packages/effect-sql); commit-bound changes belong to [`effect-changes`](https://github.com/ShivaeDev/platform/tree/main/packages/effect-changes).

### 4. When needed: live invalidation and resume

Keep ordinary operations in their contract and add a native streaming RPC to the transport group. `bind` accepts the larger client's group while retaining the original contract's types. Compiler fixtures reject a client missing an operation or changing its payload or rejection types.

Every query that should reconcile together must read the same explicit scope. This variant of the feature adds `workspace.list` alongside each query's item or list key:

```ts
import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import { Create, Get, List, notes, Rename } from "./notes.ts";

export const workspace = collection("workspace", Schema.String);
const LiveGet = query("get", {
  payload: Get.payload,
  success: Get.success,
  rejections: Get.rejections,
  reads: ({ id }) => [notes.item(id), workspace.list],
});
const LiveList = query("list", {
  success: List.success,
  reads: () => [notes.list, workspace.list],
});
export const LiveContract = contract("notes", { queries: [LiveGet, LiveList], commands: [Rename, Create] });
export const Subscribe = Rpc.make("subscribe", { stream: true, success: LiveHint });
export const LiveNotes = LiveContract.add(Subscribe);
```

Save the shared module as `live-notes.ts`. A collection list key alone does not cover its item queries. The common `workspace.list` key expresses that the caller intends to reconcile all queries that read it.

Use `LiveNotes` as the server group and implement `subscribe` with a native Stream. For streaming HTTP, the tested fixture uses `RpcSerialization.layerNdjson` on both sides. This client mounts live coordination alongside its queries:

```ts
import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { live } from "@shivaedev/effect-contract/live.ts";
import { resumeSignal } from "@shivaedev/effect-contract/resume.ts";
import { LiveContract, LiveNotes, workspace } from "./live-notes.ts";

class Client extends AtomRpc.Service<Client>()("app/LiveNotes", {
  group: LiveNotes,
  protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1:3000/rpc" }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
  ),
}) {}
const api = bind(LiveContract, Client);
const registry = AtomRegistry.make();
const updates = live(Client.runtime, {
  stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("subscribe", undefined)))),
  resyncKeys: [workspace.list],
  resume: resumeSignal({ window }),
  retryDelay: "100 millis",
});
const releaseQuery = registry.mount(api.get.query({ id: 1 }));
const releaseConnection = registry.mount(updates.connection);
```

`LiveContract` retains the declaration for binding; `LiveNotes` is the larger native RPC group for transport. The [live updates guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/live-updates.md) shows server and client composition, and the [HTTP fixture](https://github.com/ShivaeDev/platform/tree/main/packages/effect-contract/src/test-support/live) supplies a complete working server.

| Observation | Invalidation |
| --- | --- |
| `Changed` with keys after the first hint | Affected items and their lists. |
| `Resync` | The exact `resyncKeys` read scope. |
| First hint on a new or reconnected stream | The full explicit scope, even if the hint is targeted. |

`LiveHint` and `Key` are schemas. The package's schema test rejects unknown hint tags and item keys with an invalid ID type.

```ts
registry.set(updates.paused, true);
registry.set(updates.paused, false);
const status = registry.get(updates.status);
```

While paused, the HTTP consumer keeps observing hints and suppresses automatic refresh. `status.pending` saturates at 256 observations. Unpausing reconciles the explicit scope and resets the count. A resume signal also requests reconciliation; the injected native source and visible browser `online` and `visibilitychange` events are tested, while hidden events do not request refresh.

`status` exposes `connection`, `failure`, `needsResync` and `pending`. The real HTTP tests cover typed stream failure, reconnection, missed changes and clearing the stream failure after successful delivery. They also show native query atoms retaining previous successful data during a read failure and rejecting stale HTTP responses after invalidation. Query failures remain in their own `AsyncResult`; stream failures appear in `status.failure`.

The resume signal is a scoped native atom. Its browser listeners and injected source cleanup are tested on registry disposal, including a resume source used only through `live`. The HTTP fixture also verifies release of the stream subscription when the registry is disposed:

```ts
releaseQuery();
releaseConnection();
registry.dispose();
```

Call the release functions and dispose the registry when the application's root no longer owns them.

### API by module

Import the module that defines the name; the package has no root entry.

| Module | Functions and schemas |
| --- | --- |
| `operation.ts` | `query(name, { payload?, success?, rejections?, reads })`; `command(name, { payload?, success?, rejections?, invalidates })`. |
| `contract.ts` | `contract(name, { queries?, commands? })`, returning a native RPC group with `declaration: { name, queries, commands }`. |
| `rejection.ts` | `fieldRejection(struct, fields?)`; lower-level `rejectionSet(specs)`, which constructs the rejection classes, union schema and failure helpers used by operations. |
| `keys.ts` | `collection(name, idSchema)`; `Key` schema; `readKeys(keys)` and `invalidationKeys(keys)`. |
| `bind.ts` | `bind(contract, atomRpcService)`, exposing `{ query, run }` for queries and `{ run }` for commands. |
| `live.ts` | `LiveHint` schema; `live(runtime, { stream, resyncKeys, resume?, retryDelay? })`, exposing `connection`, `paused` and `status`. |
| `resume.ts` | `resumeSignal({ window?, native? })`, returning a native numeric signal atom. |

`QueryOptions` is the query atom's optional second argument: `headers?: Headers.Input`, `timeToLive?: Duration.Input` and `serializationKey?: string`. For example, `api.get.query({ id: 1 }, { timeToLive: "1 minute" })` uses the native query options interface.

| Module | Exported types |
| --- | --- |
| `operation.ts` | `Query`, `Command`, `QueryShape`, `CommandShape`, `OperationShape`, `PayloadSchema`. |
| `contract.ts` | `Contract`, `Declared`, `OperationRpc`, `Tag`. |
| `rejection.ts` | `FieldRejection`, `MatchingTags`, `Reject`, `RejectedBy`, `RejectionClass`, `RejectionSpecs`, `Rejections`, `RejectionSet`, `RejectionUnion`, `RejectionValue`, `TaggedRejection`. |
| `keys.ts` | `Collection`, `Identity`, `ItemKey`, `ListKey`, `Key`. |
| `bind.ts` | `Bound`, `BoundQuery`, `BoundCommand`, `Failure`, `RunFailure`, `QueryOptions`. |
| `live.ts` | `LiveHint`, `LiveOptions`, `LiveStatus`. |
| `resume.ts` | `ResumeOptions`, `ResumeSource`, `ResumeWindow`. |

The shape types describe operation declarations, the bound types describe client members, and the rejection types derive classes and failures from declared specs. A native resume source receives a callback and returns a cleanup function. `ResumeWindow` describes the browser event and visibility methods the signal uses.

### Install, setup and limits

```sh
pnpm add @shivaedev/effect-contract effect@4.0.0-rc.112
```

`effect` is a peer. The repository's dependency catalog uses Effect `4.0.0-rc.112`, and the package declares Node.js 24 or newer. Choose the native server host separately; this package supplies no server process or HTTP transport implementation.

- Put schema declarations where server and browser can share them. Put service, authorization and transaction implementations on the server. React rendering and editable forms belong to `effect-react` and `effect-form`.
- Run command Effects with the Reactivity instance that owns the queries to refresh, as in the registry example.
- Choose a common read key for every query in a full reconciliation scope. A list key does not implicitly cover item queries.
- Supply browser or native resume sources explicitly. Synthetic visibility and native-source tests establish signal behavior; they do not establish physical tab transitions or Capacitor lifecycle behavior.
- Live hints carry refresh requests, not authoritative data or durable history. Applications own dependency discovery, authenticated subscriptions, delivery across processes, SSR and deployment behavior. Those boundaries need their own tests.

The package's design priorities are in [docs/north-star.md](docs/north-star.md), and package work and maintainer questions are in [docs/roadmap.md](docs/roadmap.md).
