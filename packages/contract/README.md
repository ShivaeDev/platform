# @shivaedev/contract

Declare a feature's queries, commands, streams, expected failures and refresh dependencies once. The declarations become native Effect RPC definitions, and a client binding connects their dependency keys to native AtomRpc queries.

## Why you want this

A feature often repeats its inputs, results and errors on both sides of an RPC boundary, then separately wires which views a write should refresh. Those copies are easy to make disagree. Put the boundary and its dependencies together:

```ts
import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

const notes = collection("notes", Schema.Number);
const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.Array(Schema.String) });
const Rename = command("rename", {
	payload: { id: Schema.Number, title: Schema.String },
	invalidates: ({ id }) => [notes.item(id)],
});
const Notes = contract("notes", { queries: [List], commands: [Rename] });
```

`Notes` is a native RPC group with `notes.list` and `notes.rename` handlers. When its bound rename call succeeds, the declared item change refreshes the list. An item query for another note keeps its result. Handlers, middleware and transport use Effect's own APIs.

## Using it

### How to think about it

An **operation** describes a boundary, not its implementation: its name, payload schema, success schema and expected failures. A **query** also declares the keys it reads; a **command** declares the keys its successful result changes. A **stream** declares an element schema in `success`, typed rejections and the keys it reads. A **rejection** is an expected typed failure, such as a missing note or an invalid title. Middleware failures and RPC client failures remain separate parts of the native client's error type.

A **contract** groups operations into a native `RpcGroup`. Its RPC tags are the contract name and operation name joined by a dot. A **binding** connects that declaration to an existing `AtomRpc.Service`: queries get native query atoms and call Effects, while commands get call Effects that invalidate after success. Streams expose a native `Stream` through `run`; the caller owns consumption and interruption.

A **collection key** names a dependency. Its item key identifies one item; its list key identifies a list in that collection. Keys do not hold data. Native query atoms hold results, and native Reactivity asks matching queries to run again.

Optional live hints use those same keys. A hint asks for another read; it does not supply a replacement value, a journal entry or proof that a query is fresh.

### 1. Once per feature: schemas and operations

Keep the shared declaration in a module that both server and client can import:

```ts
import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";

export class Note extends Schema.Class<Note>("Note")({
	body: Schema.String,
	id: Schema.Number,
	title: Schema.String,
}) {}
export const Draft = Schema.Struct({ body: Schema.String, title: Schema.String });
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { id: Schema.Number }) {}
export const notes = collection("notes", Note.fields.id);

export const Get = query("get", {
	readPolicy: () => Effect.succeed(true),
	payload: { id: Schema.Number },
	success: Note,
	rejections: { NoteMissing },
	reads: ({ id }) => [notes.item(id)],
});
export const List = query("list", {
	readPolicy: () => Effect.succeed(true),
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

Save this module as `notes.ts`. The payload can be struct fields, as in `Get`, or a schema, as in `Create`. An omitted payload or success is `Schema.Void`; no declared rejections gives `Schema.Never`. The server resolves `reads` with the decoded payload and session viewer. For local command dependencies, the browser also evaluates it with `Option.none()`; return no viewer keys for that case. Authorized subscription scopes always come from the server. `invalidates` receives the decoded payload, successful result and optional session viewer, so a create call can invalidate the ID the server assigned.

The collection's ID schema gives `item` its ID type. Here, `notes.item` takes a number. Query and command callbacks retain their payload and result types, including when the operations are declared inline inside `contract`.

Operation names must differ within a contract, including across queries, commands and streams. Literal duplicate declarations fail compilation. If the compiler cannot see the names in an array, contract construction checks them and throws with the duplicated names.

### Expected failures

Import the shared expected failures from `@shivaedev/errors/taxonomy.ts`: `NotFound`, `Unauthorized`, `Forbidden`, `BadRequest`, `Conflict`, `PreconditionFailed`, `TooManyRequests`, `AuthUnavailable`, `InternalServerError` and `ServiceUnavailable`. Each class is a tagged error schema with a string `message`; `BadRequest` and `Conflict` also accept an optional string `field`. Declare only the failures an operation can return:

```ts
import { Effect, Schema } from "effect";
import { Rpc } from "effect/rpc";
import { BadRequest, Conflict } from "@shivaedev/errors/taxonomy.ts";

export const Rename = Rpc.make("Rename", {
	error: Schema.Union([BadRequest, Conflict]),
	payload: { name: Schema.String },
	success: Schema.String,
});
```

A handler fails with `new Conflict({ field: "name", message: "Name is taken" })`. Native RPC JSON decodes the rejection back to the error instance with its field. Taxonomy errors can be declared on an RPC with no authentication middleware. [`@shivaedev/errors`](https://github.com/ShivaeDev/platform/tree/main/packages/errors#readme) also exports `rejectedField`, which reads the field and message of a rejection on the client.

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
import { Effect, Ref, Stream } from "effect";
import { Create, Get, Note, Notes, Rename } from "./notes.ts";

export const NotesHandlers = Notes.toLayer(
	Effect.gen(function* () {
		const stored = yield* Ref.make(
			new Map([
				[1, new Note({ body: "", id: 1, title: "One" })],
				[2, new Note({ body: "", id: 2, title: "Two" })],
			]),
		);
		const find = (id: number) =>
			Effect.flatMap(Ref.get(stored), (all) => {
				const note = all.get(id);
				return note === undefined ? Get.reject.NoteMissing({ id }) : Effect.succeed(note);
			});
		const save = (note: Note) => Ref.update(stored, (all) => new Map([...all, [note.id, note]])).pipe(Effect.as(note));
		return Notes.of({
			"notes.$changes": () => Stream.never,
			"notes.get": ({ id }) => find(id),
			"notes.list": () => Effect.map(Ref.get(stored), (all) => [...all.values()]),
			"notes.rename": ({ id, title }) =>
				title.trim() === ""
					? Rename.reject.Invalid({ field: "title", message: "Enter a title" })
					: Effect.flatMap(find(id), (note) => save(new Note({ ...note, title }))),
			"notes.create": (draft) =>
				draft.title === ""
					? Create.reject.Invalid({ field: "title", message: "Enter a title" })
					: Effect.flatMap(Ref.get(stored), (all) => save(new Note({ id: all.size + 1, ...draft }))),
		});
	}),
);
```

Save this module as `handlers.ts`. An application can put repository and service calls in these handlers. The contract checks handler result and rejection types; it does not implement persistence, authorization or transactions. This in-memory server keeps the reserved change stream open without publishing hints. When a Platform host supplies that handler, build application handlers from `Notes.application` and keep `Notes` as the host and client group.

Native `.middleware(M)` returns a contract that retains its declarations. For example, a native middleware service can supply request identity:

```ts
import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
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
import { RpcSerialization, RpcServer } from "effect/rpc";
import { Notes } from "./notes.ts";
import { NotesHandlers } from "./handlers.ts";

export const NotesRoutes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "http" }).pipe(
	Layer.provide([NotesHandlers, RpcSerialization.layerJson]),
);
```

The server host provides `NotesRoutes` to its native HTTP router. In a separate client module, use the same contract:

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

export class NotesClient extends AtomRpc.Service<NotesClient>()("app/NotesClient", {
	group: Notes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1:3000/rpc" }).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
	),
}) {}
export const api = bind(Notes, NotesClient, { live: false });
```

Save the client module as `client.ts`. The [native RPC guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/native-rpc.md) covers hosting; the [reference composition](https://github.com/ShivaeDev/platform/blob/main/docs/framework/composed-example.md) composes handlers, request identity, SQL and a rendered client.

### Build a shared WebSocket client

Use `makeClient` once per session to build a native AtomRpc client and bind the contract. Clients for the same identified session, URL and upgrade options share Effect RPC's socket protocol, including when they bind different contracts or use independent registries.

```ts
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

const { api, runtime } = makeClient(Notes, {
	url: new URL("/rpc", window.location.href).href,
});
const note = api.get.query({ id: 1 });
const rename = runtime.fn(api.rename.run);
```

Browsers send the session cookie at upgrade. Mounting a query opens its subscription before running its first authorized read; unmounting cancels that subscription without restarting the socket or another query. Changed keys rerun only their readers, and equal results retain the bound atom's value. Connection failures use Effect RPC's reconnect backoff; subscriptions resume and mounted queries read again because there is no retained key history. `LiveConnection.status` reports `connecting`, `live` or `reconnecting`.

`group` supplies a larger native RPC group containing the contract, such as an admin registry. The result is a native client Layer for `ManagedRuntime.make`, plus the native `Client` service, atom `runtime` and scoped `client` Effect. Session-scoped contracts require `registry`. For Node clients, supply upgrade `headers` and `webSocketConstructor: NodeSocket.layerWebSocketConstructorWS` from `@effect/platform-node`. A native `protocol` Layer selects another transport explicitly. Use `live: false` for ordinary clients without subscriptions.

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
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { api, NotesClient } from "./client.ts";

const registry = AtomRegistry.make();
const one = api.get.query({ id: 1 });
const list = api.list.query();
const releaseOne = registry.mount(one);
const releaseList = registry.mount(list);

const renamed = await Effect.runPromise(AtomRegistry.getResult(registry, NotesClient.runtime.atom(api.rename.run({ id: 1, title: "Uno" }))));

releaseOne();
releaseList();
registry.dispose();
```

The successful rename invalidates note 1 and the list. A rejected rename invalidates neither. Bound queries and commands take the schema's decoded payload type; native clients take its constructor input, which can differ when a field has a constructor default. Result and failure types preserve operation rejections, middleware errors and `RpcClientError`.

The dependency rule is deliberately asymmetric:

| Declared key    | Query reads | Successful command invalidates |
| --------------- | ----------- | ------------------------------ |
| `notes.item(1)` | `"notes:1"` | `"notes:1"` and `"notes"`      |
| `notes.list`    | `"notes"`   | `"notes"`                      |

`readKeys` and `invalidationKeys` from `@shivaedev/changes/keys.ts` produce these native keys and remove duplicates. An item change refreshes that item and its list, preserving other item queries. A list-only invalidation refreshes list queries and leaves item queries alone. These keys match native Reactivity's record-key hashing of `{ notes: [1] }`.

Client invalidation follows RPC success. Database hosts from `@shivaedev/server` also publish declared command invalidations automatically after the handler succeeds, excluding keys already announced by repository commits, using `transact` from [`sql`](https://github.com/ShivaeDev/platform/tree/main/packages/sql); commit-bound changes belong to [`changes`](https://github.com/ShivaeDev/platform/tree/main/packages/changes).

### Session-owned keys

A self-only feature, such as a user's preferences, reads and changes only the signed-in account's records. Declare its contract with `keyScope: "session"`. The server chooses the account from request-local identity, so payloads carry no owner field, and reads and invalidations name a logical item key for the record:

```ts
const preferences = collection("preferences", Schema.String);
const Preferences = contract("preferences", {
	keyScope: "session",
	queries: [
		query("self", {
			reads: () => [preferences.item("self")],
			success: Schema.String,
		}),
	],
	commands: [
		command("save", {
			payload: { title: Schema.String },
			invalidates: () => [preferences.item("self")],
			success: Schema.String,
		}),
	],
}).middleware(Authenticated);

const api = bind(Preferences, Client, { registry });
const self = api.self.query(undefined);
const save = api.save.run({ title: "My preferences" });
```

The examples use `Schema` and `Effect` from `effect`, `contract`, `query`, `command` and `bind` from contract's defining modules, `collection` from `@shivaedev/changes/keys.ts`, and `Authenticated` from `@shivaedev/identity/middleware.ts`. `Client` is the application's native AtomRpc service, and `registry` is the atom registry that owns the session's queries. In React, `SessionBoundary` supplies that registry to `connect`, as [react's session-scoped bindings](https://github.com/ShivaeDev/platform/blob/main/packages/react/README.md#session-scoped-bindings) show.

Handlers read the account from request-local `Identity`, imported from `@shivaedev/identity/identity.ts`:

```ts
Preferences.application.toLayer({
	"preferences.self": () => Effect.flatMap(Identity, ({ id }) => store.read(id)),
	"preferences.save": ({ title }) => Effect.flatMap(Identity, ({ id }) => store.save(id, title)),
});
```

`store` is the application's persistence service. No owner or client key scope is accepted from a request. The database app host of `@shivaedev/server` resolves the server key scope from that same request-local identity.

The registry is required for session-scoped bindings. Query atoms and live connections belong in it; command and one-off query Effects execute through it. A successful command invalidates its owner's keys, while a rejected command declares no invalidation. Ordinary contracts keep unscoped keys and the two-argument `bind` call.

`List` and `Item` are still the key shapes. `readKeys(keys, { scope })` and `invalidationKeys(keys, { scope })` resolve the extra dimension while preserving item, list and wildcard semantics. An item invalidation refreshes that scope's item and list; a wildcard reaches only that scope's items. The client's opaque scope comes from its registry and is never sent as an owner id.

Server adapters read the RPC's `KeyScope` annotation. For `"session"`, they must obtain scope from request-local authenticated identity, then pass the same `{ scope }` to dependency registration, invalidation and `makeLiveServer.stream(keys, context)`. A shared server Layer must not capture identity, accept a client-selected scope or fall back to unscoped keys. This package supplies metadata and contextual keys; it has no server or authentication dependency.

### 4. Live invalidation and resume

Database hosts from `@shivaedev/server` serve the contract's reserved `<contract>.$changes` stream automatically. With the native WebSocket protocol, `bind` and a React `SessionBoundary` connect query atoms without an application subscribe operation or `live()` call. The boundary finds bound APIs returned directly by `connect` or as properties such as `client.api`. See [automatic changes](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) for defaults.

A native shell supplies its lifecycle events through `bind`'s optional `resume` source:

```ts
import { bind } from "@shivaedev/contract/bind.ts";
import type { ResumeSource } from "@shivaedev/contract/resume.ts";
import { onAppResume, onNetworkReturn } from "./native-lifecycle.ts";

const resume: ResumeSource = (notify) => {
	const stopApp = onAppResume(notify);
	const stopNetwork = onNetworkReturn(notify);
	return () => {
		stopApp();
		stopNetwork();
	};
};
const api = bind(Notes, NotesClient, { resume });
```

The application owns `onAppResume` and `onNetworkReturn`; each subscribes a callback and returns an unsubscribe function. The source joins the visible browser visibility and online defaults. Each notification reopens the live subscription and reconciles all reads tracked by the connection. The owning registry releases the source on disposal. Omitting `resume` keeps the browser defaults. Pass the same binding from React's `SessionBoundary.connect` to use it with automatic session subscriptions.

For a direct subscription, configure the server and `NotesClient` with `RpcSerialization.layerNdjson` and use the client already typed from `Notes`:

```ts
import { Effect, Stream } from "effect";
import { NotesClient } from "./client.ts";

const changes = Stream.unwrap(
	NotesClient.use((client) => Effect.succeed(client("notes.$changes", { queries: [{ query: "get", payload: { id: 1 } }] }))),
);
```

The contract includes the reserved stream's payload, `LiveHint` elements and middleware failures in its native RPC type. The subscription uses the contract's middleware and needs no separate RPC group or cast. The caller owns stream consumption and interruption. References name declared queries and reuse their payload schemas; payloadless queries use `{ query: "list", payload: undefined }`. Custom subscription handlers yield the Effect from the `ChangesQueries` annotation's `resolve(references)` method, call `querySubscription(requests, viewer)` and pass its authorized result to `makeLiveServer.subscribe(subscription, context)`. Hosted applications use `resolveChanges` from identity to supply that subscription. Session-scoped bindings track mounted queries per registry and drop their references on unmount or disposal. Ordinary bindings track query references when atoms are created.

For a custom transport or explicit pause and status controls, use the native live APIs.

Declare subscriptions with `stream` in the same contract. Its `success` schema describes each element, and its `rejections` become the native stream error schema. `bind` exposes `run(payload)` as a native `Stream`, preserving declared rejections, middleware errors and RPC client errors. Completion and client interruption release the server subscription. The compiler rejects a unary client for a streaming operation.

Each item query reads its own item key, and each list query reads its list key. Commands invalidate the keys they change; an item invalidation also refreshes its collection list. Reuse the feature's `Get`, `List`, `Rename` and `Create` declarations:

```ts
import { contract } from "@shivaedev/contract/contract.ts";
import { LiveHint } from "@shivaedev/contract/live.ts";
import { stream } from "@shivaedev/contract/operation.ts";
import { Create, Get, List, notes, Rename } from "./notes.ts";

export const Subscribe = stream("subscribe", { reads: () => [notes.list], success: LiveHint });
export const LiveNotes = contract("notes", { queries: [Get, List], commands: [Rename, Create], streams: [Subscribe] });
```

Save the shared module as `live-notes.ts`. Keep full reconciliation in the session's explicit `resyncKeys`: enumerate the item keys the session reads and its list keys. A list key alone does not cover separately registered item queries. Having every query read a broad shared key makes every invalidation of that key refetch them all.

Use `LiveNotes` as the server group and implement `notes.subscribe` with a native Stream. For streaming HTTP, use `RpcSerialization.layerNdjson` on both sides. This client mounts live coordination alongside its queries:

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { live } from "@shivaedev/contract/live.ts";
import { resumeSignal } from "@shivaedev/contract/resume.ts";
import { LiveNotes } from "./live-notes.ts";
import { notes } from "./notes.ts";

class Client extends AtomRpc.Service<Client>()("app/LiveNotes", {
	group: LiveNotes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1:3000/rpc" }).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
	),
}) {}
const api = bind(LiveNotes, Client);
const registry = AtomRegistry.make();
const updates = live(Client.runtime, {
	stream: api.subscribe.run(undefined),
	resyncKeys: [notes.item(1), notes.item(2), notes.list],
	resume: resumeSignal({ window }),
	retryDelay: "100 millis",
});
const releaseQuery = registry.mount(api.get.query({ id: 1 }));
const releaseConnection = registry.mount(updates.connection);
```

`LiveNotes` supplies both the declaration for binding and the native RPC group for transport. Stream read keys describe its dependencies; `run` does not mount query atoms or trigger automatic invalidation. Here the caller explicitly reconciles two items and their list. `bind` also accepts a larger native client group that preserves the contract RPC types. The [live updates guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/live-updates.md) shows server and client composition, and the [HTTP fixture](https://github.com/ShivaeDev/platform/tree/main/packages/contract/src/test-support/live) supplies a complete working server.

| Observation                               | Invalidation                                           |
| ----------------------------------------- | ------------------------------------------------------ |
| `Changed` with keys after the first hint  | Affected items and their lists.                        |
| `Resync`                                  | The exact `resyncKeys` read scope.                     |
| First hint on a new or reconnected stream | The full explicit scope, even if the hint is targeted. |

Changed hints share a fixed 20 ms window by default. Their keys merge, and each affected bound query refetches once per window. A bound query already fetching keeps its request and refetches once more after it settles if further hints arrive. Set `coalesceWindow` in `live()` to a native Duration, or set `SessionBoundary`'s `liveCoalesceWindow` for automatic session connections. Zero restores immediate per-hint invalidation, including interruption of in-flight reads. Full reconciliation on first hint, reconnect, resume and unpause stays immediate. Registry teardown cancels a pending window.

`queryCoalesceWindow(query)` from `@shivaedev/contract/queryCoalesceWindow.ts` returns a writable native atom for that bound query's live changed-hint window. Set it through the query's registry to a Duration, or `undefined` to use the live connection's default. Changing it does not refetch or reconnect; the next window uses the new value. React consumers can set it with `useQuery(query, { coalesceWindow: "2 seconds" })`.

`LiveHint` and `Key` are schemas. Decoding rejects unknown hint tags and item keys with an invalid ID type.

```ts
registry.set(updates.paused, true);
registry.set(updates.paused, false);
const status = registry.get(updates.status);
```

While paused, live coordination keeps observing hints and suppresses automatic refresh. `status.pending` saturates at 256 observations. Unpausing reconciles the explicit scope and resets the count. A resume signal also requests reconciliation: an injected native source and visible browser `online` and `visibilitychange` events request it, while hidden events do not.

`status` exposes `connection`, `failure`, `needsResync` and `pending`. A reconnection reconciles changes missed while disconnected, and successful delivery clears a typed stream failure. Native query atoms keep previous successful data during a read failure and reject stale responses after invalidation. Query failures remain in their own `AsyncResult`; stream failures appear in `status.failure`.

The resume signal is a scoped native atom. Disposing the registry removes its browser listeners, cleans up an injected source, including one used only through `live`, and releases the stream subscription:

```ts
releaseQuery();
releaseConnection();
registry.dispose();
```

Call the release functions and dispose the registry when the application's root no longer owns them.

### Server hint streams

Import `makeLiveServer` from `@shivaedev/contract/makeLiveServer.ts` and create it once with the server's `Reactivity` service. After application authorization, return `hints.stream([orders.item(id)])` from the native streaming RPC handler. Each subscription starts with `Resync`; invalidating its read keys produces `Changed` with those declared keys. `hints.resync` sends `Resync` to every live stream owned by that helper, including streams for otherwise unrelated keys. Independent helpers keep their resync scopes separate even when they share Reactivity. The native stream owns registration and interruption. Keep this server helper separate from the browser's `live` coordinator.

### Query policies, record keys and buckets

A query declares its decoded input, result, `readPolicy` and `reads` together. `readPolicy(payload, viewer)` returns an Effect boolean. `viewer` is the session's `Option<{ id: string }>`; the browser does not send the identity. Policies may use browser-safe Effect service tags whose implementations the server supplies.

```ts
import { Effect, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { query } from "@shivaedev/contract/operation.ts";

const notes = collection("notes", Schema.Number, { userId: Schema.String });
const Mine = query("mine", {
	payload: { title: Schema.String },
	success: Schema.Array(Schema.String),
	readPolicy: (_input, viewer) => Effect.succeed(Option.isSome(viewer)),
	reads: (_input, viewer) => (Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
});
```

A record key, `notes.item(id)`, names one record. A bucket, `notes.bucket.userId(id)`, names every row with that field value. Declare bucket fields on the collection model with their schemas. A list may add title, state or other filters to its input and handler, but those filters never narrow its bucket. It reruns whenever any row in that bucket changes, including a row excluded by the filter. Writers explicitly announce the record and affected buckets with the same constructors from `@shivaedev/changes/keys.ts`.

The same query policy guards running the query and subscribing to it. A subscription names query references, never arbitrary record or bucket keys. The entire subscription is refused with `QueryReadDenied` if any referenced query is denied. Without `readPolicy`, a query has no authorized live subscription: `MissingReadPolicy` tells its author to declare one. Bound query atoms also refuse a missing policy before their first read. Ordinary one-off `run` calls remain available. Reads outside a declared query acquire no automatic subscription.

The session middleware supplies the viewer and runs `authorizeReads(effect, request, viewer)`. Custom middleware calls that function after resolving its session and declares `MissingReadPolicy` and `QueryReadDenied` in its error schema. Before delivering changed keys, the stream rechecks the owning query's policy without memoization. A client refresh runs the same authorized query that produced its first value; hints carry no row values.

### Live hints in stories

Use `watchHints` and `heard` from `@shivaedev/contract/testing.ts` in an application's story kit. Pass each viewer's authenticated live stream to `watchHints`; it starts a scoped subscription and waits for its first hint before returning the viewer handle.

```ts
const alice = yield* watchHints(aliceChanges);
const bob = yield* watchHints(bobChanges);
yield* renameNote;
expect(yield* heard(alice, [notes.item(1)])).toBe(true);
expect(yield* heard(bob, [notes.item(1)], { within: "50 millis" })).toBe(false);
```

`heard` returns `true` once a delivered `Changed` hint contains all the requested keys, including hints received before the call. Extra keys are allowed; `Resync` does not count. It returns `false` when no matching hint arrives within `within` (one second by default). Waiting uses the story's Effect clock, so a test clock controls expiry. Stream failures stay in the typed error channel. Keep expectations in the spec; the support verbs need no retry loops or hidden assertions.

### API by module

Import the module that defines the name; the package has no root entry.

| Module                   | Functions and schemas                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operation.ts`           | `query(name, { payload?, success?, rejections?, readPolicy?, reads })`; `command(name, { payload?, success?, rejections?, invalidates })`; `stream(name, { payload?, success, rejections?, reads })`.                                                                                                                                                                                                   |
| `contract.ts`            | `contract(name, { queries?, commands?, streams?, keyScope? })`, returning a native RPC group with `declaration: { name, queries, commands, streams, keyScope }`.                                                                                                                                                                                                                                        |
| `rejection.ts`           | `fieldRejection(struct, fields?)`; lower-level `rejectionSet(specs)`, which constructs the rejection classes, union schema and failure helpers used by operations.                                                                                                                                                                                                                                      |
| `bind.ts`                | `bind(contract, atomRpcService, { registry?, live?, resume? }?)`, requiring the registry for session-scoped contracts and exposing `{ query, run }` for queries, `{ run }` Effects for commands and `{ run }` native Streams for streams; `makeClient(contract, { url, protocol?, headers?, webSocketConstructor?, group?, registry?, live? })`, which builds the shared WebSocket client and binds it. |
| `queryCoalesceWindow.ts` | `queryCoalesceWindow(query)`, a writable atom for a bound query's live changed-hint window.                                                                                                                                                                                                                                                                                                             |
| `live.ts`                | `LiveHint` schema; `live(runtime, { stream, resyncKeys, coalesceWindow?, initialResync?, keyContext?, resume?, retryDelay? })`, exposing `connection`, `coalesceWindow`, `paused` and `status`.                                                                                                                                                                                                         |
| `querySubscription.ts`   | `querySubscription(requests, viewer)` checks each referenced query and captures its scopes and ongoing authorization.                                                                                                                                                                                                                                                                                   |
| `makeLiveServer.ts`      | `makeLiveServer`, an Effect requiring `Reactivity` that creates scoped server hint streams and a `resync` Effect.                                                                                                                                                                                                                                                                                       |
| `readPolicy.ts`          | `QueryReadPolicy`, `Viewer`, `authorizeReads(effect, request, viewer)`, `CurrentViewer`.                                                                                                                                                                                                                                                                                                                |
| `readPolicyErrors.ts`    | `MissingReadPolicy` and `QueryReadDenied`.                                                                                                                                                                                                                                                                                                                                                              |
| `serverMetadata.ts`      | `KeyScope`, `QueryDefinition.definition`, `CommandInvalidation.invalidates`, `ChangesQueries.resolve(references)`, the Effect `queryKeys(queries, references)` and `changesRpc(name, queries)` for server adapters.                                                                                                                                                                                     |
| `resume.ts`              | `resumeSignal({ window?, native? })`, returning a native numeric signal atom.                                                                                                                                                                                                                                                                                                                           |
| `testing.ts`             | `watchHints(stream)` starts a scoped viewer subscription; `heard(viewer, keys, { within? }?)` waits for matching changed keys.                                                                                                                                                                                                                                                                          |

A query atom takes native query options as its optional second argument, for example `api.get.query({ id: 1 }, { timeToLive: "1 minute" })`. A native resume source receives a callback and returns a cleanup function.

### Install, setup and limits

```sh
pnpm add @shivaedev/contract effect
```

`effect` is a peer, and the package needs Node.js 24 or newer. Choose the native server host separately; this package supplies no server process or HTTP transport implementation.
- Put schema declarations where server and browser can share them. Put service, authorization and transaction implementations on the server. React rendering and editable forms belong to `react` and `form`.
- Run command Effects with the Reactivity instance that owns the queries to refresh, as in the registry example.
- Choose a common read key for every query in a full reconciliation scope. A list key does not implicitly cover item queries.
- Supply browser or native resume sources explicitly.
- Live hints carry refresh requests, not authoritative data or durable history. Applications own dependency discovery, authenticated subscriptions, delivery across processes, SSR and deployment behavior.

The automatic live connection exposed at `api[LiveConnection]` includes a writable `paused` atom. Set it in the binding’s registry to pause refreshes; clearing it reconciles the mounted queries.
