# Optional native live invalidation

`effect-contract/live.ts` composes an opt-in hint stream with the same native
Reactivity instance that owns a consumer's AtomRpc queries. It owns neither a
cache nor authoritative data. Ordinary typed queries establish current values;
the application discovers dependencies and decides which keys changed.

The worked example is the [HTTP consumer test](../../packages/effect-contract/src/liveConsumer.spec.ts): it mounts two documents and a derived list, and its contract declares a streaming operation alongside its queries.

## Server and client composition

Use `stream` from `effect-contract/operation.ts` with `LiveHint` as its `success` schema and application failures in `rejections`. Add it to the contract's `streams` array. For HTTP streaming, both sides use native
`RpcSerialization.layerNdjson`; ordinary `layerJson` buffers the entire response
and cannot deliver an unending subscription's hints. The fixture uses native
`RpcServer.layerHttp`, a loopback Node HTTP server, native FetchHttpClient,
AtomRpc, and a browser-owned AtomRegistry. No React, CDN or second transport
protocol is required.

```ts
const subscription = live(Client.runtime, {
  stream: api.subscribe.run(undefined),
  resyncKeys: Subscribe.reads(undefined),
  resume: resumeSignal({ window }),
});
const release = registry.mount(subscription.connection);
```

`stream` can be any ordinary native Stream compatible with the runtime; RPC is
one transport. Mount `connection` once in the application's root registry.
Native atoms own query identity, retained results, interruption and disposal.
Releasing the final mount closes the stream without an idle grace period;
disposing the registry closes query and runtime resources too.

## Keys and reconciliation

| Hint | Meaning |
| --- | --- |
| `Changed` with `keys` | Invalidate these existing contract keys. An item also invalidates its collection list; unrelated item queries retain their identity and result. |
| `Resync` | Invalidate the caller's explicit `resyncKeys`. |
| First hint on a fresh/reconnected stream | Invalidate the full explicit scope, even if that hint is targeted. |

Every query in this fixture declares `workspace.list` as well as its own reads.
That common key allows full reconciliation. Invalidating `documents.list` alone
does **not** invalidate separately registered document items. Full reconciliation
uses the exact declared read keys, rather than broadening them through the
item-to-list mutation convention.

Acquire the server subscription before emitting an initial `Resync`, so edits
between catch-up and subscription registration cannot fall into a gap. The
fixture uses a bounded PubSub with backpressure; a production publisher must
explicitly reconcile any loss or overflow rather than silently dropping hints.
Unknown tags or malformed keys fail the RPC Schema boundary; they do not turn
into arbitrary invalidations. A subsequent successful stream reconciles the
full scope. Application indexing uncertainty should emit `Resync` directly.

## Pause, resume and failures

Set `paused` through the registry. The stream keeps consuming hints while
automatic invalidation stops. `status.pending` saturates at 256 observed hints,
retaining no unbounded key list. It is not a count of complete source history.
Unpausing always requests full scoped reconciliation and clears that count.
An optional native atom in `resume` requests the same reconciliation when it
changes; while paused, it records the need for reconciliation without fetching.
`effect-contract/resume.ts` supplies the browser-safe `resumeSignal`: visible
`online` and `visibilitychange` events and an optional injected native source.
The live helper initializes derived resume atoms before observing them, so
source listeners attach even without a separate UI subscriber. Their finalizers
release on registry teardown.

`effect-react/resumeSignal.ts` delegates to the shared implementation.

An ended or failed stream enters `reconnecting` and retries after one second by
default. `retryDelay` lets the consumer choose a positive native Duration for its
deployment. Typed stream failures remain in `status.failure`; first successful
delivery clears them. The runtime's initialization failure remains in the
`connection` atom's native AsyncResult. Read failures remain in each query's
AsyncResult, which retains its previous success. Connection state and query
freshness are separate: `needsResync: false` means invalidation was issued, not
that every query completed or the source is accepted.

## Limits

There is no replay cursor, event journal, offline mutation or deployment delivery guarantee. The [PostgreSQL composition](./composed-example.md) shows delivery between processes after commit.
