# @shivaedev/effect-changes

A cache or live view needs to hear about committed writes, but sending from inside a transaction can announce data that never lands. This package collects explicitly recorded changes at an Effect transaction boundary, so a rollback announces nothing and a commit publishes the distinct notifications once.

## Why you want this

A membership grant affects both its owner and its member. The write names both subjects; the transaction boundary waits until commit before telling readers to refresh:

```ts
yield* Effect.gen(function* () {
  yield* sql`insert into membership (owner, member) values (${owner}, ${member})`;
  yield* membershipChanges.record([
    { subject: owner, domain: "memberships" },
    { subject: member, domain: "memberships" },
  ]);
}).pipe(membershipChanges.within(sql.withTransaction));
```

`membershipChanges` is the channel defined below. It groups notifications by subject and domain, so another write to the same member inside this transaction does not add a second notification. A nested transaction that rolls back contributes no notification, and a failed outer commit publishes nothing. Feature code describes what changed; the native transaction decides whether it happened.

## Using it

### How to think about it

A **channel** connects recorded changes to one publish function. A **transaction owner** identifies the database or client whose commit those changes belong to. A **transaction frame** is an ordered buffer for that owner's recorded changes: a root commit publishes the buffer, a nested commit merges it into its parent, and a rollback discards it.

Owners matter when a program uses more than one database or client. Owner B committing inside owner A's transaction publishes B's changes at B's commit, even if A later rolls back. Re-entering A inside B joins A's existing frame. A record follows the owner selected by its `owner` Effect, rather than whichever transaction is innermost in the program.

The channel owns notifications, not writes. Record descriptions of what needs refreshing beside the write that affects it. Choose a key that identifies notifications that can share one refresh; this boundary is for coalescing refresh work, rather than storing every business event.

The work has three parts:

1. Once per binding, define the change type, owner, key and publish function, and bind the native transaction.
2. Once per feature, record the subjects affected by each write.
3. In each operation, run the feature through the transaction boundary or group autocommitted work with a batch.

### 1. Once per binding: define the channel

```ts
import { makeChannel } from "@shivaedev/effect-changes/channel.ts";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

interface MembershipChange {
  readonly subject: string;
  readonly domain: string;
}

const published: Array<MembershipChange> = [];

const membershipChanges = makeChannel<MembershipChange, SqlClient.SqlClient>({
  name: "MembershipChanges",
  owner: Effect.map(SqlClient.SqlClient, (sql) => sql.transactionService),
  key: (change) => `${change.subject}:${change.domain}`,
  publish: (changes) => Effect.sync(() => {
    published.push(...changes);
  }),
});
```

The owner is the native SQL client's transaction-service identity. The key groups each subject and domain. The publish function collects notifications here; replace it with the application's notification or invalidation Effect. The channel's `R` parameter describes the services its owner and publish function require.

`within(native)(body)` wraps an Effect transaction combinator. Its native combinator must run the body once and return success only after the root commit or successful native nested outcome. A successful nested scope can leave its savepoint open until the root transaction settles. Use an existing binding when it already owns the job: [effect-sql](https://github.com/ShivaeDev/platform/tree/main/packages/effect-sql#readme) provides the SQL boundary for Reactivity keys, and [effect-changes-prisma](https://github.com/ShivaeDev/platform/tree/main/packages/effect-changes-prisma#readme) provides the Prisma driver and mapped write recording.

### 2. Once per feature: record the affected subjects

```ts
const grantMembership = (owner: string, member: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`insert into membership (owner, member) values (${owner}, ${member})`;
    yield* membershipChanges.record([
      { subject: owner, domain: "memberships" },
      { subject: member, domain: "memberships" },
    ]);
  });
```

One write can name several subjects. `record` deduplicates the supplied changes by the channel's key, and the transaction frame deduplicates across later records and committed nested frames. Keys retain their first-seen order.

Record while the transaction body is still running. A record or a nested frame opened from work that outlives its settled frame dies instead of silently losing the changes. A child frame also cannot merge into a parent that has already settled.

### 3. In an operation: use the transaction boundary

```ts
const grant = (owner: string, member: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* grantMembership(owner, member).pipe(
      membershipChanges.within(sql.withTransaction),
    );
  });
```

Provide the application's native SQL layer when running `grant`. Publication happens after the native transaction succeeds and before the wrapper returns. A typed failure, defect, body interruption or failed commit discards the root frame. A nested commit merges into its parent; a nested rollback leaves the parent's own changes intact.

When interruption arrives while commit is in flight, the boundary waits for the native outcome. A successful commit still publishes its changes, and the caller still sees the interruption. This is covered by the channel's deterministic transaction fixture and by the SQL binding's PostgreSQL commit tests.

Concurrent records from Effects that inherit the same frame join that frame and publish together. Keep all write-related work within the transaction's lifetime.

### Group already-autocommitted writes

```ts
const grantSeveral = Effect.gen(function* () {
  yield* grantMembership("ada", "bob");
  yield* grantMembership("ada", "cyd");
}).pipe(membershipChanges.batch);
```

This example uses no transaction: the native SQL writes autocommit, while `batch` groups their notifications. Success, typed failure and interruption all publish the batch's recorded changes, because those writes have already landed.

A transaction inside a batch merges into the batch when it commits and drops its changes when it rolls back. A batch inside a transaction merges into that transaction, including when the batch fails and its failure is caught; the enclosing transaction decides whether those changes publish.

Without a frame or batch, a record publishes immediately. An optional `unowned` guard runs before an unframed record or a root transaction frame opens. A batch is not an owned transaction, so its records and transactions opened inside it still run that guard. A binding can use the guard to refuse a native transaction whose commit the channel cannot observe.

### Bind a driver that reports its outcome through a Promise

`open` and `Frame` let a driver binding control settlement directly. Open the frame before entering the driver's transaction callback, provide the callback's Effect body with `frame.provide`, and settle only after the driver reports its commit outcome.

Capture the application's Effect context before running callback work in another
fiber. Its Effect exit describes the body, not whether the driver committed. A
binding must make a failed body reject the driver's transaction, wait for its
Promise, and translate that driver's result into an `Outcome`.

Settle with `"committed"` only after the root commit or successful native nested
outcome, and `"rolledBack"` when that operation fails. The first settlement
outcome wins, so calling it again cannot publish twice.

For an interruptible Promise driver, the binding must keep waiting for the pending transaction result after caller interruption and settle from that result. The [complete Prisma driver adapter](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes-prisma/src/transaction.ts) shows context capture, failed-body rejection, aborting the body, awaiting the driver and retaining its typed errors. Do not treat an interrupted wait or a successful body as the driver's commit result.

### Decide what a publish failure means

A failed publish function runs after the transaction's data has committed. The default `onPublishFailure: "log"` logs an Error with its cause, channel name and change count, while preserving the committed result. This applies to an Effect failure, a defect and a synchronous throw from the publish function.

Set `onPublishFailure: "die"` when that same delivery failure should raise a defect. The data remains committed; this policy does not undo the write. Any retry policy belongs in the publish function.

### Capture notifications in tests

```ts
import type { Observation } from "@shivaedev/effect-changes/observe.ts";
import { Layer } from "effect";

const captured: Array<MembershipChange> = [];
const observations: Array<Observation<MembershipChange>> = [];

const captureSink = Layer.succeed(
  membershipChanges.Sink,
  (changes: readonly MembershipChange[]) => Effect.sync(() => {
    captured.push(...changes);
  }),
);

const observe = Layer.succeed(
  membershipChanges.Observer,
  (observation: Observation<MembershipChange>) => Effect.sync(() => {
    observations.push(observation);
  }),
);

const capturedGrant = grant("ada", "bob").pipe(
  Effect.provide(Layer.merge(captureSink, observe)),
);
```

`Sink` and `Observer` are channel-specific `Context.Reference`s. Within the provided scope, the sink receives the changes instead of the configured publish function; the configured sink resumes outside it. The observer receives `Recorded` for the distinct changes in a record call, `Published` for the buffer passed to publication and `Discarded` for a rolled-back frame's changes. `Published` is emitted before the sink runs; it does not prove successful delivery. Discarded parent changes include changes merged from children that committed earlier. A rollback therefore remains visible to a coverage check through its earlier `Recorded` observation.

### API

Import from the module that defines the name; the package has no root entry.

| Module | Names |
| --- | --- |
| `channel.ts` | `makeChannel`, `ChannelOptions`, `Channel` |
| `frame.ts` | `Frame`, `Outcome` |
| `observe.ts` | `Observation`, `Observer` |
| `publish.ts` | `Publish`, `PublishFailure` |

```ts
interface ChannelOptions<A, R> {
  readonly name: string;
  readonly owner: Effect.Effect<unknown, never, R>;
  readonly key?: (change: A) => unknown;
  readonly publish: Publish<A, R>;
  readonly onPublishFailure?: PublishFailure;
  readonly unowned?: Effect.Effect<void, never, R>;
}

interface Channel<A, R> {
  readonly record: (changes: Iterable<A>) => Effect.Effect<void, never, R>;
  readonly within: <X, E, R2, E2, R3>(
    native: (body: Effect.Effect<X, E, R2>) => Effect.Effect<X, E2, R3>,
  ) => (body: Effect.Effect<X, E, R2>) => Effect.Effect<X, E2, R | R3>;
  readonly open: Effect.Effect<Frame, never, R>;
  readonly batch: <X, E, R2>(body: Effect.Effect<X, E, R2>) => Effect.Effect<X, E, R | R2>;
  readonly Sink: Context.Reference<Publish<A, R>>;
  readonly Observer: Context.Reference<Observer<A>>;
}

interface Frame {
  readonly provide: <X, E, R>(body: Effect.Effect<X, E, R>) => Effect.Effect<X, E, R>;
  readonly settle: (outcome: Outcome) => Effect.Effect<void>;
}

type Outcome = "committed" | "rolledBack";
type PublishFailure = "log" | "die";
type Publish<A, R = never> = (changes: readonly A[]) => Effect.Effect<void, unknown, R>;
type Observer<A> = (observation: Observation<A>) => Effect.Effect<void>;
type Observation<A> =
  | { readonly _tag: "Recorded"; readonly changes: readonly A[] }
  | { readonly _tag: "Published"; readonly changes: readonly A[] }
  | { readonly _tag: "Discarded"; readonly changes: readonly A[] };
```

`makeChannel<A, R = never>(options)` returns `Channel<A, R>`. `key` is optional; for string changes, omitting it deduplicates repeated strings. A custom key is useful when a change is a structured description of an affected subject.

The modules also export the implementation helpers `Buffer`, `makeBuffer`, `settled`, `add`, `keyed`, `makeFrame` from `frame.ts`, `unobserved` from `observe.ts`, and `publisher` from `publish.ts`. The channel uses these to manage its buffers and delivery policy.

### Install, setup and limits

```sh
pnpm add @shivaedev/effect-changes effect@4.0.0-rc.112
```

`effect` is a peer dependency, so the application's Effect version runs the channel. The package declares Node 24 or newer. The SQL example also needs the application's native SQL driver and layer; neither the channel nor its installation creates a database connection or table.

- The channel is an in-process notification boundary. It has no persistent outbox, replay or cross-process transport; deployment delivery requires a separate design.
- Only explicitly recorded changes reach the channel. Trigger, cascade and raw SQL write discovery belongs to a binding or the application.
- A native adapter must observe the real commit outcome. Wrapping only the body of a transaction does not establish that outcome.
- Use a durable event design when every business event must be retained. A deduplicated notification is a request to refresh, not an event journal.
- Core tests use a fake transaction. SQL and Prisma bindings have PostgreSQL tests for their actual commit behavior, which require a database URL to run.
