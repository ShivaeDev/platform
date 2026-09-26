# @shivaedev/effect-changes

Commit-bound change channels for Effect. Code that writes rows records the changes it made; the channel publishes them only after the transaction that wrote them commits, once, deduplicated. A rollback, a failed `COMMIT` or an interruption before `COMMIT` publishes nothing.

The package imports only `effect` and runs in browsers and servers. It knows nothing about SQL or any ORM: a channel binds to a database through two things you supply, the transaction owner and the native transaction.

```ts
import { makeChannel } from "@shivaedev/effect-changes";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

interface ChangeEvent {
  readonly userId: string;
  readonly domain: string;
}
declare const bus: { readonly emit: (event: ChangeEvent) => void };

const liveChanges = makeChannel<ChangeEvent, SqlClient.SqlClient>({
  name: "LiveChanges",
  owner: Effect.map(SqlClient.SqlClient, (sql) => sql.transactionService),
  key: (event) => `${event.userId}:${event.domain}`,
  publish: (events) => Effect.sync(() => events.forEach((event) => bus.emit(event))),
});

const addMember = (owner: string, member: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`insert into membership (owner, member) values (${owner}, ${member})`;
    yield* liveChanges.record([
      { userId: owner, domain: "memberships" },
      { userId: member, domain: "memberships" },
    ]);
  });

const program = Effect.flatMap(SqlClient.SqlClient, (sql) => liveChanges.within(sql.withTransaction)(addMember("owner", "member")));
```

## API

```ts
makeChannel<A, R = never>(options: ChannelOptions<A, R>): Channel<A, R>

type Publish<A, R = never> = (changes: ReadonlyArray<A>) => Effect<void, unknown, R>;
type PublishFailure = "log" | "die";
type Outcome = "committed" | "rolledBack";

interface ChannelOptions<A, R> {
  readonly name: string;
  readonly owner: Effect<unknown, never, R>;
  readonly key?: (change: A) => unknown;
  readonly publish: Publish<A, R>;
  readonly onPublishFailure?: PublishFailure;
  readonly unowned?: Effect<void, never, R>;
}

interface Channel<A, R> {
  readonly record: (changes: Iterable<A>) => Effect<void, never, R>;
  readonly within: <X, E, R2, E2, R3>(
    native: (body: Effect<X, E, R2>) => Effect<X, E2, R3>,
  ) => (body: Effect<X, E, R2>) => Effect<X, E2, R | R3>;
  readonly open: Effect<Frame, never, R>;
  readonly batch: <X, E, R2>(body: Effect<X, E, R2>) => Effect<X, E, R | R2>;
  readonly Sink: Context.Reference<Publish<A, R>>;
  readonly Observer: Context.Reference<Observer<A>>;
}

interface Frame {
  readonly provide: <X, E, R>(body: Effect<X, E, R>) => Effect<X, E, R>;
  readonly settle: (outcome: Outcome) => Effect<void>;
}

type Observation<A> =
  | { readonly _tag: "Recorded"; readonly changes: ReadonlyArray<A> }
  | { readonly _tag: "Published"; readonly changes: ReadonlyArray<A> }
  | { readonly _tag: "Discarded"; readonly changes: ReadonlyArray<A> };
type Observer<A> = (observation: Observation<A>) => Effect<void>;
```

- `owner` identifies the transaction a change belongs to, usually one value per database or connection pool. Frames are kept per owner.
- `key` deduplicates changes. It defaults to the change itself (`Set` semantics). The first occurrence of a key keeps its place.
- `record` accepts any number of changes; one write may notify several subjects.
- `within(native)` wraps a native transaction combinator whose success means `COMMIT` (or savepoint release) happened, such as `sql.withTransaction`.
- `open` and `settle` are for drivers that report the commit through a Promise, such as Prisma's interactive `$transaction`. Open a frame, run the body with `frame.provide`, and settle it with the driver's outcome.
- `batch` defers publishing for work outside a transaction, for example one request. Its writes were autocommitted, so it publishes on any exit.
- `unowned` is an optional guard that runs when a change is recorded, or a root frame opened, with no transaction frame for the owner. Use it to refuse native transactions the channel cannot observe.

## Semantics

| Situation | Root frame | Nested frame (savepoint) |
| --- | --- | --- |
| Body succeeds and the native transaction commits | Publish the distinct changes once, before `within` returns | Merge into the parent frame |
| Typed failure, defect, interruption before `COMMIT`, or failed `COMMIT` | Discard | Discard; the parent keeps its own changes |
| `record` after the frame settled | Die | Die |
| `record` with no frame for the owner | Run `unowned`, then publish immediately | n/a |

- A frame for owner B opened inside a frame for owner A is a root for B: it publishes when B commits, even if A rolls back later. Re-entering A inside B joins A's frame.
- The publish decision follows the commit, not the fiber. `within` runs the native combinator uninterruptibly apart from the body, so an interruption that arrives while `COMMIT` is in flight takes effect after it; the changes publish if the database committed, and the caller still sees the interruption. The native combinator must run the body once and succeed only when it committed.
- `settle` is idempotent and uninterruptible; the first outcome wins. Publishing is uninterruptible.
- A `batch` inside a transaction merges into it on any exit and follows the transaction's outcome. Transactions inside a batch merge into it when they commit.

## Publish failures

The data is committed by the time a sink runs, so a failing sink cannot undo it. With the default `onPublishFailure: "log"`, a failed Effect, a defect, or a sink function that throws synchronously is logged once as an error with its full cause, the channel name and the change count; the span is annotated, and the caller's committed result stands. `"die"` turns the failure into a defect instead. Retries belong in the sink.

## Testing

`channel.Sink` and `channel.Observer` are `Context.Reference`s. Provide them to a test's scope; production code that never provides them uses the configured sink and no observer.

```ts
const published: Array<ChangeEvent> = [];
const captureSink = Layer.succeed(liveChanges.Sink, (events: ReadonlyArray<ChangeEvent>) => Effect.sync(() => published.push(...events)));

const observations: Array<Observation<ChangeEvent>> = [];
const observe = Layer.succeed(liveChanges.Observer, (observation: Observation<ChangeEvent>) => Effect.sync(() => observations.push(observation)));
```

- The sink override replaces `publish` for everything that runs in its scope, including frames settled later from that scope. The failure policy still applies.
- The observer sees every accepted `record` call as `Recorded` (its distinct changes), every frame dropped by a rollback or failed commit as `Discarded` (including changes merged into it from committed savepoints), and every publish as `Published` (what the sink receives). A change recorded in a rolled-back savepoint therefore appears as `Recorded` and `Discarded`.

## Limits

- Delivery is in-process. A crash between `COMMIT` and publishing loses the changes, together with the in-process subscribers that would have received them.
- There is no cross-process delivery. PostgreSQL `NOTIFY` is itself commit-bound and would be the natural transport; it is not implemented.
- Changes with the same key are not merged; the first one wins.
- Only changes that code records are published. Writes made by triggers, cascades or raw SQL that does not call `record` are invisible to the channel.

This release targets Effect `4.0.0-rc.112`.
