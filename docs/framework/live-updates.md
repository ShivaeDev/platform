# Live invalidation

Database-backed Platform hosts and React session boundaries provide live queries by default. Declare query read policies and record or bucket scopes, bind the contract with its default shared WebSocket client, and return the binding from the session's `connect`, directly or as a property such as `api`. See [commit-bound changes](./changes.md). Mounting each query registers its subscription before its first read; unmounting cancels it without restarting the connection. Explicit coordination remains useful for custom streams or application pause/status controls.

`@shivaedev/contract/live.ts` composes an opt-in hint stream with the same native Reactivity instance that owns a consumer's AtomRpc queries. It owns neither a cache nor authoritative data. Ordinary typed queries establish current values; the application discovers dependencies and decides which keys changed.

The worked example is the [HTTP consumer test](../../packages/contract/src/liveConsumer.spec.ts): it mounts two notes and a derived list, and its contract declares a streaming operation alongside its queries.

## Server and client composition

Use `stream` from `@shivaedev/contract/operation.ts` with `LiveHint` as its `success` schema, its read keys in `reads` and application failures in `rejections`. Add it to the contract's `streams` array. For HTTP streaming, both sides use native `RpcSerialization.layerNdjson`; ordinary `layerJson` buffers the entire response and cannot deliver an unending subscription's hints. The fixture uses native `RpcServer.layerHttp`, a loopback Node HTTP server, native FetchHttpClient, AtomRpc, and a browser-owned AtomRegistry. No React, CDN or second transport protocol is required.

```ts
const subscription = live(Client.runtime, {
	stream: api.subscribe.run(undefined),
	resyncKeys: [documents.item("one"), documents.item("two"), documents.list],
	coalesceWindow: "20 millis",
	resume: resumeSignal({ window }),
});
const release = registry.mount(subscription.connection);
```

`stream` can be any ordinary native Stream compatible with the runtime; RPC is one transport. Mount `connection` once in the application's root registry. Native atoms own query identity, retained results, interruption and disposal. Releasing the final mount closes the stream without an idle grace period; disposing the registry closes query and runtime resources too.

## Keys and reconciliation

| Hint                                     | Meaning                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Changed` with `keys`                    | Invalidate these existing contract keys. An item also invalidates its collection list; unrelated item queries retain their identity and result. |
| `Resync`                                 | Invalidate the caller's explicit `resyncKeys`.                                                                                                  |
| First hint on a fresh/reconnected stream | Invalidate the full explicit scope, even if that hint is targeted.                                                                              |

Declare reads per entity, and invalidate only what a command changes:

```ts
const Get = query("get", {
	payload: { id: Schema.String },
	success: Document,
	reads: ({ id }) => [documents.item(id)],
});
const List = query("list", {
	success: Schema.Array(Document),
	reads: () => [documents.list],
});
const Edit = command("edit", {
	payload: { id: Schema.String, body: Schema.String },
	success: Document,
	invalidates: ({ id }) => [documents.item(id)],
});
```

An item invalidation refreshes that item and its collection list, leaving unrelated item queries alone. Each query reads its own item or list keys. Do not add one broad shared read key to every query: invalidating it refetches every reader. Full reconciliation instead uses the session's explicit `resyncKeys`, listing its item keys and list keys. Invalidating `documents.list` alone does not invalidate separately registered document items. Reconciliation uses exact read keys, without the item-to-list mutation convention. A function in `resyncKeys` can supply a changing session scope.

## Query policies, record keys and buckets

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

The same query policy guards running the query and subscribing to it. A subscription names query references, never arbitrary record or bucket keys. The entire subscription is refused with `QueryReadDenied` if any referenced query is denied. Without `readPolicy`, a query has no authorized live subscription: `MissingReadPolicy` tells its author to declare one. Ordinary non-live reads remain available. Reads outside a declared query acquire no automatic subscription.

The session middleware supplies the viewer and runs `authorizeReads(effect, request, viewer)`. Custom middleware calls that function after resolving its session and declares `MissingReadPolicy` and `QueryReadDenied` in its error schema. Before delivering changed keys, the stream rechecks the owning query's policy without memoization. A client refresh runs the same authorized query that produced its first value; hints carry no row values.

## Coalescing commits

Changed hints merge their keys over a fixed window that starts at the first hint. The default is 20 ms. Each affected bound query refetches at most once for that window. If a refetch is still in flight, further windows mark it dirty; it refetches once more after settling and reads the newest value. Native atoms continue to own values, query identity and disposal.

Set `coalesceWindow` in `live()` using a native Duration, or set `liveCoalesceWindow` on React's `SessionBoundary` for its automatic connections. Explicit consumers can change the `coalesceWindow` atom through their registry. Zero restores immediate per-hint invalidation and its native interruption behavior. First-hint, `Resync`, reconnect, resume and unpause reconciliation stay immediate and clear queued changed keys. Disposing the connection cancels its window.

Acquire the server subscription before emitting an initial `Resync`, so edits between catch-up and subscription registration cannot fall into a gap. The fixture uses a bounded PubSub with backpressure; a production publisher must explicitly reconcile any loss or overflow rather than silently dropping hints. Unknown tags or malformed keys fail the RPC Schema boundary; they do not turn into arbitrary invalidations. A subsequent successful stream reconciles the full scope. Application indexing uncertainty should emit `Resync` directly.

## Pause, resume and failures

Set `paused` through the registry. The stream keeps consuming hints while automatic invalidation stops. `status.pending` saturates at 256 observed hints, retaining no unbounded key list. It is not a count of complete source history. Unpausing always requests full scoped reconciliation and clears that count. An optional native atom in `resume` requests the same reconciliation when it changes; while paused, it records the need for reconciliation without fetching. `@shivaedev/contract/resume.ts` supplies the browser-safe `resumeSignal`: visible `online` and `visibilitychange` events and an optional injected native source. The live helper initializes derived resume atoms before observing them, so source listeners attach even without a separate UI subscriber. Their finalizers release on registry teardown.

`@shivaedev/react/resumeSignal.ts` delegates to the shared implementation.

An ended or failed stream enters `reconnecting` and retries after one second by default. `retryDelay` lets the consumer choose a positive native Duration for its deployment. Typed stream failures remain in `status.failure`; first successful delivery clears them. The runtime's initialization failure remains in the `connection` atom's native AsyncResult. Read failures remain in each query's AsyncResult, which retains its previous success. Connection state and query freshness are separate: `needsResync: false` means invalidation was issued, not that every query completed or the source is accepted.

## Limits

There is no replay cursor, event journal, offline mutation or deployment delivery guarantee. The [PostgreSQL composition](./composed-example.md) shows delivery between processes after commit.
