# Live queries

Database-backed Platform hosts and React session boundaries provide live queries by default. Model fields define write buckets, queries declare who may read them, a query's repository reads name the keys it listens on, and mounted queries subscribe over the client's shared WebSocket. Start with this automatic path, as the [starter notes feature](../../examples/starter/src/modules/notes/Notes.ts) does. It needs no subscribe operation, `live()` call or hand-written invalidation.

## Mark buckets on the stored model

Use `bucket` from `@shivaedev/changes/buckets.ts` on fields that group rows for readers. For example, a user's notes belong to the `userId` bucket:

```ts
import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";

const notes = collection("notes", Schema.Number, { userId: Schema.String });

class StoredNote extends Model.Class<StoredNote>("StoredNote")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	title: Schema.String,
	userId: bucket(Schema.String),
}) {}

const makeNotesRepository = makeRepository(StoredNote, { collection: notes });
```

A model with `bucket` fields needs `collection`, and the collection names the table: `collection("water_entries", ...)` makes a repository on `water_entries`, and `tableName` is not accepted beside it. Its bucket fields must match the model's. Otherwise building the repository fails with `BucketRegistrationError` before any write, and its message names what to change, as the [registration stories](../../packages/sql/src/bucketRegistration.spec.ts) show.

Repository writes derive record keys and affected old and new bucket keys from the rows SQL returns, inside the write's transaction. Moving a note between owners announces both owners' buckets. A command whose writes go through these repositories declares no `invalidates` and calls no invalidation helper at its write sites. A command declares `invalidates` only for a change that no repository write or recorded `changes` announces, such as a write to a store outside PostgreSQL; the host publishes those keys after the handler returns, and the live queries that read them rerun. The [bucket stories](../../packages/sql/src/bucketKeys.spec.ts) cover inserts, moves and deletes against PostgreSQL.

Use `transact` from `@shivaedev/sql/transact.ts` for an enclosing transaction, in request handlers and workers alike. A repository write opens `transact` when called alone and joins an enclosing one. Its pre-commit hook sends PostgreSQL NOTIFY on the writing connection, so rollback discards the notification with the write, as the [commit and rollback stories](../../packages/sql/src/automaticChanges.spec.ts) prove. A bare native transaction has no observed commit boundary.

### Raw SQL writers

Only raw-SQL writers declare write keys manually. Use `changes` from `@shivaedev/sql/changes.ts` to name the affected records and buckets once, then call its `record()` method inside the same `transact` as the SQL write. For a title change scoped to a known owner, using the `notes` collection declared above:

```ts
import { changes } from "@shivaedev/sql/changes.ts";
import { transact } from "@shivaedev/sql/transact.ts";

const renamed = changes({ notes: [notes.item(id), notes.bucket.userId(userId)] });

yield* Effect.gen(function* () {
	yield* sql`update notes set title = ${title} where id = ${id} and user_id = ${userId}`;
	yield* renamed.record();
}).pipe(transact());
```

A raw SQL move must include both the old and new bucket keys. Repository writes derive these automatically from the stored rows. See [commit-bound changes](./changes.md) for raw-write coverage and transaction composition.

## Declare who may read, and let the reads name their keys

A query's `readPolicy(payload, viewer)` returns an Effect boolean. `viewer` is the session's `Option<{ id: string }>`; the browser does not send the identity. Policies may use browser-safe Effect service tags whose implementations the server supplies. A query that declares no `readPolicy` gets contract's `signedIn`, which admits any signed-in viewer, so the starter's notes queries write none:

```ts
import { Effect, Option } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { NoteId } from "#modules/notes/model.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";

export const Get = query("get", {
	payload: NoteId,
	*run({ id }) {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		const row = yield* repository.findOne({ where: { id, userId } });
		return yield* Option.match(row, { onNone: () => Effect.fail(new NotFound({ message: "Note not found" })), onSome: Effect.succeed });
	},
});

export const List = query("list", {
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany({ orderBy: { direction: "desc", field: "id" }, where: { userId } });
	},
});
```

Neither query declares `reads`. A query that declares no keys listens on what its repository reads filter by, named from their arguments before the statement is sent. `get` reads `findOne({ where: { id, userId } })` and listens on that note's row; `list` reads `findMany({ where: { userId } })` and listens on the owner's `userId` bucket. A read that pins every column of a tuple bucket, such as `findMany({ where: { ownerId, day } })` over an `ownerDay` tuple declared on the collection as the [sql guide](../../packages/sql/README.md#transactions-and-invalidation) shows, listens on that tuple's key; a tuple pinned only in part pins nothing, so the read falls back to a single-column bucket it pins. A read that pins no id and no bucket, or only buckets over 1,000 keys, listens on the whole table. The [sql guide](../../packages/sql/README.md#live-reads-listen-on-what-they-filter-by) lists which key each filter pins. Filters on other columns do not narrow the key: a list filtered by owner and status reruns for any write in the owner's bucket.

Declared keys win. A query that declares `reads`, `serverReads` or `readsCollections` listens exactly on those keys, and its repository reads add none. Declare them when the keys cannot come from a repository read:

- A raw SQL read, such as a join, marks its key by interpolating it as the parameter it filters by with `readSql` from `@shivaedev/sql/readSql.ts`, as the [sql guide](../../packages/sql/README.md#a-raw-read-names-its-key-at-its-parameter) shows. A read through the native `sql` tag records no key, so a query built from such reads keeps a declared `reads`, such as `reads: () => [notes.list]` for a count over the whole table. When a query that declares no keys finishes a run without recording one, the host logs a warning that names it.
- A raw read of a tuple bucket or a composite row declares its key, as in `reads: ({ day }, viewer) => (Option.isSome(viewer) ? [entries.bucket.ownerDay({ ownerId: viewer.value.id, day })] : [])`, because `readSql` binds one column per parameter and refuses such a key.
- `reads: () => []` declares that a query reads nothing live, and logs no warning.

The browser keeps no keys: every query reruns on the server and receives its new result over its subscription, so the keys a host records are all a query needs.

Session-scoped contracts use these same keys. `keyScope: "session"` runs a contract's operations in the session's registry and adds no server key prefix. Repository writes from workers reach matching subscriptions without an authenticated write context. Shared dependencies can cause reruns for several accounts; model buckets narrow that fan-out.

## Push current results from the socket process

Opening a live query checks its policies, registers its declared keys, runs the authorized handler, which registers each key its reads record before the statement that reads by it, and sends its first `Result` on the subscription. Every later matching change reloads the subscriber's session so roles are current, checks the read policy, and runs that same handler in that context. The process holding the socket performs the work. It encodes the result through the query's success schema and stores one hash per subscribed query in memory. Changed values are pushed as `Result`; equal reads send only an `Unchanged` completion acknowledgement. The client never follows a change or `Resync` with a read. Query results retain exactly their declared shape.

Queries from different subscribers never share reruns, even for identical inputs. Each viewer has their own session, policy check and handler execution. A denied recheck sends `QueryReadDenied` without query SQL and clears the stored hash; restoring permission can therefore deliver the same value again. React screens render denial before retained data. Ordinary one-off reads still use the same policy and handler.

Each subscription permits one running rerun and one pending rerun. Hints during a rerun mark it dirty and merge their keys; the next rerun consumes that pending work. A burst received during a held rerun therefore costs at most two reruns, including the one in flight. Subscriptions run independently in parallel, with no global concurrency cap. There is no client coalescing window.

`Resync` is a server reconciliation signal for uncertain change history. More than 256 queued hints collapse pending keys into one `Resync`, and subsequent hints are absorbed until it is consumed. The server then reruns the affected subscriptions' authorized queries and pushes changed values itself. There is no replay cursor or event journal. The PostgreSQL and React stories exercise separate committed writes, policy denial during a burst and a real loopback socket stalled across 257 commits.

Pausing through `api[LiveConnection].paused` keeps consuming updates while holding the screen's value. Its pending count saturates at 256 observations. Unpausing reopens subscriptions for a current result. Visible online, visibility and optional native resume events also reopen active subscriptions. Typed rejections stay settled until their supported retry trigger; transport failures and defects use jittered backoff. Disposing the registry releases the streams and lifecycle listeners.

## Know when a command's change is on the screen

A command's reply reaches the client before the live queries it changed are updated. The client gives each command a number and names itself on its live streams. When the handler has finished, the host sends that number as a sync token on the change channel behind the command's keys. Every host's listener reads it in order, and the host holding that client's socket queues it in each of that client's subscriptions behind the hints already waiting there. A subscription confirms the token on its own stream after the reruns ahead of it. The client folds the confirmations into one signal per command with the states `sent`, `accepted` and `reflected`, and applies no optimistic update. Without PostgreSQL the host hands the token to its subscriptions directly.

`untilReflected` from `@shivaedev/contract/commandSignal.ts` completes a command's Effect when it is reflected, and a client's `sync` waits the same way for writes it did not make. Client activity counts a command as pending until it is reflected or fails. A command that publishes nothing is reflected when its token returns, and a failed command sends no token and leaves nothing to wait for. The token leaves after the handler's last commit. Work a command starts for later, such as a job, is not covered. The [contract README](../../packages/contract/README.md#when-a-commands-change-is-on-the-screen) lists the rules for queries opened mid-command, reconnects, paused connections, a listener that was down, hosts from before sync tokens and other clients.

## PostgreSQL delivery and pool configuration

The application host connects repository commits to PostgreSQL NOTIFY and shares native Reactivity with the socket's live server. Configure `maxConnections` through sql's `postgresLayer(url, options)` or the host's existing `config.maxConnections`. The default is 10 connections, unchanged from native `PgPool`. The listener reserves one connection when it shares that pool; queries and transactions share the remaining budget, as the [host pool stories](../../packages/server/src/appHostPool.spec.ts) show by filling the pool with one fewer transaction than `maxConnections`. A separate `config.listenDatabaseUrl` can provide a direct or session-mode listener connection. Both URLs must reach the same database.

LISTEN requires a session connection. Startup waits for its own heartbeat. NOTIFY is a wake-up signal, not a durable log. Raw SQL writers must record their keys inside `transact`; rollback discards both writes and notifications. Payloads contain keys rather than row values, and oversized keys fail before commit.

## Session revalidation and cost

Authenticated streams on one WebSocket that recheck the session together share one in-flight session lookup. A later recheck performs a fresh lookup; no session result is cached between rechecks. Different sockets share no session lookup. The [shared revalidation stories](../../packages/identity/src/server/sharedRevalidation.spec.ts) show one lookup serving four streams on a socket and a sign-out reaching all of them at the next check. Subscription policies and query handlers run independently.

For one shared-bucket commit across S sockets and N subscriptions, the PostgreSQL cost story measures S session lookups, 2N read-policy checks and N query reruns. Each subscriber checks policy during subscription revalidation and again through the authorized query runner. There are no client read requests after delivery.

| Queries per socket | Total subscriptions | Session lookups | Read-policy checks | Query reruns |
| ------------------ | ------------------- | --------------- | ------------------ | ------------ |
| 1                  | 12                  | 12              | 24                 | 12           |
| 8                  | 96                  | 12              | 192                | 96           |

Counts exclude initial subscription reads and the command's authorization and write SQL. The story runs a real loopback WebSocket host and PostgreSQL. It establishes this single-commit fan-out cost, without claims about deployment latency, provider-specific SQL, browser suspension or host restart. Separate commit batches and slow subscriptions can add work. Run `pnpm --filter @shivaedev/server test src/liveCost.spec.ts` with `PLATFORM_SQL_TEST_DATABASE_URL` configured.
