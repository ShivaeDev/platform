# Live queries

Database-backed Platform hosts and React session boundaries provide live queries by default. Model fields define write buckets, queries declare authorized reads, and mounted queries subscribe over the client's shared WebSocket. Start with this automatic path, as the [starter notes feature](../../examples/starter/src/modules/notes/notes.ts) does. It needs no subscribe operation, `live()` call or hand-written invalidation.

## Mark buckets on the stored model

Use `bucket` from `@shivaedev/changes/buckets.ts` on fields that group rows for readers. For example, a user's notes belong to the `userId` bucket:

```ts
import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";

class StoredNote extends Model.Class<StoredNote>("StoredNote")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.String,
	userId: bucket(Schema.String),
}) {}

const makeNotesRepository = makeRepository(StoredNote, {
	idColumn: "id",
	spanPrefix: "Notes",
	tableName: "notes",
});
```

Repository writes derive record keys and affected old and new bucket keys from the rows SQL returns, inside the write's transaction. Moving a note between owners announces both owners' buckets. Commands over these repositories use `invalidates: () => []`; do not repeat record or bucket keys there or call an invalidation helper at write sites. The [bucket stories](../../packages/sql/src/bucketKeys.spec.ts) cover inserts, moves and deletes against PostgreSQL.

Use `transact` for an enclosing transaction. Its pre-commit hook sends PostgreSQL NOTIFY on the writing connection, so rollback discards the notification with the write, as the [commit and rollback stories](../../packages/sql/src/automaticChanges.spec.ts) prove. A bare native transaction has no observed commit boundary. Raw SQL writes must declare their affected keys explicitly; joins and views still need explicit query `reads`. See [commit-bound changes](./changes.md) for raw-write coverage and transaction composition.

## Declare authorized query reads

A query declares its decoded input, result, `readPolicy` and `reads` together. `readPolicy(payload, viewer)` returns an Effect boolean. `viewer` is the session's `Option<{ id: string }>`; the browser does not send the identity. Policies may use browser-safe Effect service tags whose implementations the server supplies.

```ts
import { Effect, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";

const notes = collection("notes", Schema.Number, { userId: Schema.String });
const Mine = query("mine", {
	payload: { title: Schema.String },
	success: Schema.Array(Schema.String),
	readPolicy: (_input, viewer) => Effect.succeed(Option.isSome(viewer)),
	reads: (_input, viewer) => (Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
});
const Notes = contract("notes", { queries: [Mine] }).middleware(AuthenticatedUser);
```

Use the same collection name, ID schema and bucket field names as the stored model. A record key, `notes.item(id)`, names one record. A bucket, `notes.bucket.userId(id)`, names every row with that field value. A list may add title, state or other filters to its input and handler, but those filters never narrow its bucket. A matching bucket change triggers the query’s configured live behavior, including when the changed row is excluded by the filter. See [commit-bound changes](./changes.md) for the automatic write path and raw SQL limits.

The same query policy guards running the query and subscribing to it. A subscription names query references, never arbitrary record or bucket keys. The entire subscription is refused with `QueryReadDenied` if any referenced query is denied. `readPolicy` is required on every query. The host validates query declarations before startup; an untyped query missing a policy fails startup with `MissingReadPolicies`, naming the affected queries. A custom native server that bypasses this validation still refuses both reads and subscriptions with `MissingReadPolicy`. The [startup stories](../../packages/contract/src/readPolicyStartup.spec.ts) and [fallback stories](../../packages/contract/src/readPolicyFallback.spec.ts) prove these boundaries. Reads outside a declared query acquire no automatic subscription.

The session middleware supplies the viewer and runs `authorizeReads(effect, request, viewer)`. Custom middleware calls that function after resolving its session and declares `MissingReadPolicy` and `QueryReadDenied` in its error schema. Before delivering a hint, the stream rechecks the owning query's policy without memoization. A denied query-policy recheck ends that subscription with `QueryReadDenied`; it never silently drops the hint. Automatic bound queries expose that denial directly in the query result without another authorized read. Render that failure before retained data. Further changes cannot reach the ended subscription. The default hint-and-refetch path runs the same authorized query that produced its first value; hints carry no row values.

The [viewer stories](../../packages/contract/src/viewerHints.spec.ts) prove bucket filtering, refused subscriptions and termination on a denied recheck. Read-policy revocation is detected on the next matching hint, including `Resync`; an idle read policy is not polled. Session revalidation below checks session validity, so it does not impose a deadline on an idle application-policy change.

## Connect once through the session

Serve the contract through database-backed `appHost`; workers using `appDatabase` share its PostgreSQL change channel. Both enable changes automatically. The channel derives from `APP_NAME`, falling back to the database URL pathname. Processes must select the same channel; `config.changes.channel` can set it explicitly. The host supplies `<contract>.$changes` under the contract's middleware; the application adds no stream handler.

Use `makeClient` from `@shivaedev/contract/bind.ts`, or bind an existing native AtomRpc client with `bind`. The default `makeClient` transport is a shared WebSocket to the RPC URL. Return the bound API from `SessionBoundary.connect`, directly or under a property such as `api`; the boundary discovers and mounts its live connection. The starter's [client registration](../../examples/starter/src/modules/notes/client/registration.tsx) and [session boundary](../../examples/starter/src/client/SessionApp.tsx) show the full composition.

For the `Notes` contract above, pass this `connect` to the session boundary and use the returned API's `mine.query({ title })` with `useQuery` inside it:

```ts
import { makeClient } from "@shivaedev/contract/bind.ts";

const connect = () =>
	makeClient(Notes, {
		url: new URL("/rpc", window.location.href).href,
	}).api;
```

Mounting a bound query registers its subscription before the first authorized read. Unmounting cancels that subscription without restarting other queries or the connection. Reconnect reconciles mounted queries through current authorized reads. Reads made outside a declared bound query acquire no automatic subscription. The [starter live-note stories](../../examples/starter/src/modules/notes/server/liveNotes.spec.ts) exercise owner-scoped lists and note details over this socket path.

## Rerun-and-compare queries

Set `live: "rerun-and-compare"` on a query to receive results only when its encoded value changes:

```ts
const Mine = query("mine", {
	live: "rerun-and-compare",
	payload: { title: Schema.String },
	success: Schema.Array(Schema.String),
	readPolicy: (_input, viewer) => Effect.succeed(Option.isSome(viewer)),
	reads: (_input, viewer) => (Option.isSome(viewer) ? [notes.bucket.userId(viewer.value.id)] : []),
});
```

The host registers the subscription before running its initial authorized read as the subscribed viewer. On each matching change or Resync, it runs that same query handler through `authorizeReads`, encodes the value with the query’s JSON codec, and compares its SHA-256 hash with the last result sent on that subscription. An unchanged result sends no hint, key, hash or result for that query. A filtered-out change therefore reveals nothing through that query’s deliveries. Queries sharing a subscription retain their own delivery behavior.

The contract’s `$changes` schema includes typed `Result` messages for opted-in queries, naming the query and its index in the requested references. `bind` and `makeClient` place those decoded results in the bound query without a client refetch. The initial value also comes from the subscription. Explicit refresh reopens the subscription to read current values. Resume and unpause reopen active subscriptions; they leave a settled rejection alone. A denied policy check ends the stream with `QueryReadDenied`; declared query failures remain typed stream failures. Queries without this option keep hints and ordinary client refetches.

A custom host calls `makeLiveServer.subscribe(subscription, keyContext, authorizedRunner)` and supplies Effect’s `Crypto` service. The runner executes the referenced query through its authorized read with the captured request identity. Missing a runner for an opted-in query fails the stream. Platform’s application host supplies both automatically.

Comparison suppresses deliveries, not server reads: each matching change still incurs a policy check, query execution, encoding and hashing per subscribed query. Use deterministic read ordering when order is part of the result. Hashes belong to one connection; reconnects send a fresh initial result. The existing queue bound and reconciliation behavior apply, and this option adds no replay or durable delivery guarantee.

The [rerun-and-compare stories](../../packages/server/src/rerunCompare.spec.ts) prove filtered-out changes send nothing, changed typed results reach bound queries without a client read, mixed subscriptions retain each mode, and denied reruns expose failure.

## Coalescing and slow consumers

Changed hints merge keys over a fixed window that starts at the first hint, 20 ms by default. Each affected bound query refetches at most once for that window. If a refetch is in flight, later windows mark it dirty and it reads again after settling. Set `liveCoalesceWindow` on `SessionBoundary` to change the window; zero restores immediate per-hint invalidation. For active subscriptions, first-hint, `Resync`, reconnect, resume and unpause reconciliation stay immediate and clear queued keys. The [coalescing stories](../../packages/contract/src/liveCoalescing.spec.ts) exercise bursts and edits during a read. This client refetch budget does not cap rerun-and-compare's server reads.

`makeLiveServer` bounds each stream's queue to 256 hints. When it fills, pending hints collapse into one `Resync`, absorbing further hints until the consumer pulls it. The client reconciles its full read scope when delivery resumes. The [slow-consumer story](../../packages/contract/src/slowConsumer.spec.ts) stalls delivery across 257 and 1,000 edits and checks the single pending reconciliation and newest result. The bound counts hints; key and result sizes depend on the subscription. RPC, socket and proxy buffers have their own limits.

## PostgreSQL listener connections

LISTEN requires a direct or session-mode PostgreSQL connection. If `DATABASE_URL` uses a transaction pooler, set `LISTEN_DATABASE_URL` to a direct connection to the same database, or supply `config.listenDatabaseUrl` as an Effect `Redacted<string>` to `appHost` or `appDatabase`. The config value takes precedence over the environment. Without either setting, the listener uses the application pool and URL. Writes, migrations and heartbeat publication stay on the application pool; a separate listener reserves one additional connection.

Before host startup completes, the listener must receive its own heartbeat within `config.changes.heartbeatTimeout` (10 seconds by default). A timeout fails startup with `PostgresListenerError`, naming the selected setting and requiring a direct or session-mode connection. SQL errors remain typed SQL failures. After successful startup, a lost listener still reconnects and resynchronizes live streams; a permanently broken connection after startup can therefore continue to cause repeated Resyncs until its configuration is corrected.

The [listener-connection stories](../../packages/server/src/listenerConnection.spec.ts) prove URL selection, delivery and failure when the startup heartbeat is not received. They mute a real PostgreSQL listener; they do not run PgBouncer or certify a particular pooler. NOTIFY payloads must be smaller than 8,000 bytes. The adapter splits key arrays and rejects an individual key that cannot fit, rolling back its transaction, as the [payload stories](../../packages/sql/src/postgresChangeNotifications.spec.ts) show. Bucket writes require PostgreSQL 18 native `RETURNING old` values.

## Session revalidation window and per-hint cost

A hosted WebSocket owns one session revalidation timer, shared by all its authenticated streams. Session rechecks using the same provider join a batch on the next event-loop turn and share its in-flight lookup. Once it finishes, the next batch performs a fresh lookup; there is no session TTL cache. Origin admission, role resolution and each subscription's read policy still run independently. Different sockets and different session providers do not share session results.

Each interval checks every registered stream through that shared lookup. `streamRevalidationInterval` is 30 seconds by default; the [shared revalidation stories](../../packages/identity/src/server/sharedRevalidation.spec.ts) use a five-second interval to prove idle revocation and one lookup for four streams. An expired or replaced session ends every affected stream with `Unauthorized`; an unavailable session provider ends them with `AuthUnavailable`. Hint-time session checks use those same failures; a valid session whose query policy denies access ends with `QueryReadDenied`. The [live-session stories](../../packages/identity/src/server/liveSubscriptionSession.spec.ts) prove sign-out, revocation, expiry and provider outages at both detection points. Ordinary query reads authenticate independently and keep their typed result and authorization path. Custom RPC hosts can provide `SocketSession` from `makeSocketSession(interval)` in the connection's scope; without that service, identity middleware keeps its per-stream timer. Closing a stream removes its check, and closing the socket releases the timer.

For one hint batch from a shared-bucket write in hint-and-refetch mode, the measured subscriber budget is S + N session lookups, 3N read-policy checks and N query reruns, where S sockets each watch N/S queries. Per affected query, that is one authenticated read lookup, three policy checks and one rerun, plus the hint-time lookup shared by its socket. The hosted read currently checks the policy in both identity middleware and the host guard, in addition to the hint-time check. Policy checks and query SQL therefore still grow with query count. Separate hint batches, concurrent writes, reconnects and slow readers can add work; this is a single-write fan-out budget, not a process-wide rate limit.

A loopback measurement against real PostgreSQL, with 12 signed-in viewers, one socket per viewer, native RPC query subscriptions and an authorized typed read after each hint, records:

| Queries per socket | Total queries | Session lookups | Read-policy checks | Query reruns |
| ------------------ | ------------- | --------------- | ------------------ | ------------ |
| 1                  | 12            | 24              | 36                 | 12           |
| 8                  | 96            | 108             | 288                | 96           |

The write uses the repository's model-derived bucket keys and no command invalidations. Counts exclude initial connection/subscription reads and the command's own authorization and write SQL, and include the complete subscriber fan-out. These counts measure the host and identity composition, not browser rendering, provider-specific session SQL, deployment latency or a host restart. The [PostgreSQL load story](../../packages/server/src/liveCost.spec.ts) measures this budget. Run it with `PLATFORM_SQL_TEST_DATABASE_URL` set: `pnpm --filter @shivaedev/server test src/liveCost.spec.ts`. It asserts delivery and the shared-session budget at both query counts. There is no measured CPU, latency, provider SQL or rerun-and-compare fan-out budget here.

## Derived command keys and publication gaps

For derived keys that repository writes cannot name, command `invalidates(payload, result, viewer)` keys publish after the handler returns. The handler keeps its own transaction and SQL error mapping. Keys that must commit atomically with a write come from the stored model's `bucket()` fields and the repository, rather than `invalidates`; repository writes already announce their record and bucket keys, so commands need not repeat them.

Declared-key publication retries twice with 50 ms and 100 ms backoffs. It retries only publication, preserving the committed handler result. If all three attempts fail, a database-backed host sends Resync to its local live streams and attempts a broadcast Resync on the PostgreSQL change channel. All listening hosts reconcile their streams on that broadcast. If PostgreSQL cannot be reached or rejects the broadcast, local streams still receive Resync and the failure is logged, but a healthy remote listener can remain stale until a later reconnect, listener recovery or other reconciliation. There is no durable replay of a notification that never reached PostgreSQL. The [publication stories](../../packages/identity/src/server/commandPublication.spec.ts) prove retry, local reconciliation and broadcast delivery, including a refused broadcast.

## Recovery, restarts and environment limits

NOTIFY is not a durable log: there is no replay cursor, event journal, offline mutation or deployment delivery guarantee. The [listener recovery stories](../../packages/sql/src/postgresListenerRecovery.spec.ts) prove Resync on loss, failed reconnects and recovery. Reconciliation reads authoritative data; it does not replay missed writes. The [PostgreSQL composition](./composed-example.md) proves after-commit delivery between separate HTTP servers and a worker, with DOM-rendered editors. It does not prove a production deployment, SSR or mobile.

An expected rejection, including `QueryReadDenied`, `NotFound` or another declared query error, settles with `connection: "failed"` and its typed cause in `status.failure`. It makes no timed retries. Automatic queries reopen on a viewer identity change or a matching change invalidation; resume events and unrelated hints leave the rejection settled. The [denied-subscription stories](../../packages/contract/src/deniedSubscription.spec.ts) cover both hinted and pushed queries. Each new subscription must pass authorization again.

An unexpected stream end, transport failure or server defect enters `reconnecting` and retries with exponential backoff. `retryDelay` sets the initial base delay, one second by default; the base doubles up to 30 seconds, and each attempt draws fresh jitter between 80% and 120% of its base. The [retry stories](../../packages/contract/src/liveRetry.spec.ts) exercise increasing delays and recovery. The default shared WebSocket transport jitters its exponential backoff from a 500 ms base, multiplying by 1.5 up to a 5 second base, with actual delays from 80% to 120% of that base. Custom transports own their retry policy. The [restart stories](../../packages/server/src/hostRestart.spec.ts) kill a host process and replace it on the same port: twelve Node clients with two mounted queries each receive all 24 new reads, and their first reads spread over more than 50 ms. That is the measured recovery workload; it is not a browser test, database load measurement, maximum recovery time or server-wide request rate limit.

The opt-in [browser check](../../packages/browser-check/README.md#check-the-starters-live-notes) opens two awake Chromium tabs on a running starter, requires a socket hint, a reread and the rendered note in the second tab, then checks sign-out removes private data and closes that tab's original socket. It is a local smoke check, outside app CI. DOM and Node stories do not establish browser lifecycle behavior; sleeping tabs, other browsers, proxies, deployment rollouts and particular pooler products have no adoption proof here. Run the check against the environment you intend to use.

## Explicit hint streams for custom transports

This section is for an application-owned hint source or a custom HTTP streaming consumer. It replaces automatic subscription coordination for those queries. Do not add it to the starter or mount it alongside automatic live queries: set `{ live: false }` in `bind` or `makeClient` before coordinating the same bound queries with `live()`.

`@shivaedev/contract/live.ts` composes that opt-in hint stream with the native Reactivity instance that owns the consumer's AtomRpc queries. It owns neither a cache nor authoritative data. The application supplies the changed keys and reconciliation scope. The worked [HTTP consumer story](../../packages/contract/src/liveConsumer.spec.ts) mounts two notes and a derived list with an explicitly declared streaming operation.

### Compose the custom stream

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

### Keys and reconciliation

| Hint                                     | Meaning                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Changed` with `keys`                    | Invalidate these existing contract keys. An item also invalidates its collection list; unrelated item queries retain their identity and result. |
| `Resync`                                 | Invalidate the caller's explicit `resyncKeys`.                                                                                                  |
| First hint on a fresh/reconnected stream | Invalidate the full explicit scope, even if that hint is targeted.                                                                              |

For this explicit-key example, supply the application's `documentReadPolicy` and `documentListReadPolicy`. Declare reads per entity and command keys for changes the custom source must announce:

```ts
const Get = query("get", {
	payload: { id: Schema.String },
	readPolicy: documentReadPolicy,
	success: Document,
	reads: ({ id }) => [documents.item(id)],
});
const List = query("list", {
	readPolicy: documentListReadPolicy,
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

### Manual coalescing, pause and status

Set `coalesceWindow` in `live()` using a native Duration, or change its atom through the registry. Disposing the connection cancels its window. Acquire the server subscription before emitting initial `Resync` so edits during catch-up cannot fall into a registration gap. The HTTP fixture uses bounded PubSub with backpressure; a custom publisher must reconcile loss or overflow. Unknown tags and malformed keys fail the RPC Schema boundary. A later successful stream reconciles the full scope; application indexing uncertainty should emit `Resync` directly.

Set `paused` through the registry. The stream keeps consuming hints while automatic invalidation stops. `status.pending` saturates at 256 observed hints, retaining no unbounded key list. It is not a count of complete source history. Unpausing an active subscription requests full scoped reconciliation and clears that count. An optional native atom in `resume` requests the same reconciliation for active subscriptions when it changes; while paused, it records the need for reconciliation without fetching. `@shivaedev/contract/resume.ts` supplies the browser-safe `resumeSignal`: visible `online` and `visibilitychange` events and an optional injected native source. The live helper initializes derived resume atoms before observing them, so source listeners attach even without a separate UI subscriber. Their finalizers release on registry teardown.

For settled rejections, low-level `live()` listens to `retryKeys`, defaulting to its `resyncKeys`, for matching invalidations. Resume events leave the rejection settled, as described above.

Typed stream failures remain in `status.failure`; first successful delivery clears them. The runtime's initialization failure remains in the `connection` atom's native AsyncResult. Read failures remain in each query's AsyncResult, which retains its previous success. Connection state and query freshness are separate: `needsResync: false` means invalidation was issued, not that every query completed or the source is accepted.
