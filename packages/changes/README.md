# @shivaedev/changes

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

## Record keys and buckets

`keys.ts` owns the shared dependency format for contract queries, committed writes and subscriptions. An item key identifies a record by id. A bucket identifies every row with a declared field value; a collection list key covers the whole collection.

```ts
import { Schema } from "effect";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";

const notes = collection("notes", Schema.Number, { userId: Schema.String, listId: Schema.Number });
const keys = [notes.item(1), notes.bucket.userId("alice"), notes.bucket.listId(42)];
const invalidations = invalidationKeys(keys);
```

Use `readKeys(keys)` to register dependencies with native Reactivity and `invalidationKeys(keys)` when announcing committed writes. A bucket changes only when the writer explicitly names it. Its value is typed by the declared field schema. A filtered list query still reads its entire bucket and reruns when any row there changes. Record changes also invalidate the collection list, while buckets remain explicit. The channel can buffer these keys until commit just like any other change vocabulary.

Query read policies belong to the contract. The query checks its session viewer before its record or bucket scope can become a subscription; a change key grants no read permission. See the [contract query guide](../contract/README.md#query-policies-record-keys-and-buckets).

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
import { makeChannel } from "@shivaedev/changes/channel.ts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";

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

`within(native)(body)` wraps an Effect transaction combinator. Its native combinator must run the body once and return success only after the root commit or successful native nested outcome. A successful nested scope can leave its savepoint open until the root transaction settles. Use an existing binding when it already owns the job: [sql](https://github.com/ShivaeDev/platform/tree/main/packages/sql#readme) provides the SQL boundary for Reactivity keys.

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

When interruption arrives while commit is in flight, the boundary waits for the native outcome. A successful commit still publishes its changes, and the caller still sees the interruption.

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

Capture the application's Effect context before running callback work in another fiber. Its Effect exit describes the body, not whether the driver committed. A binding must make a failed body reject the driver's transaction, wait for its Promise, and translate that driver's result into an `Outcome`.

Settle with `"committed"` only after the root commit or successful native nested outcome, and `"rolledBack"` when that operation fails. The first settlement outcome wins, so calling it again cannot publish twice.

For an interruptible Promise driver, the binding must keep waiting for the pending transaction result after caller interruption and settle from that result. Do not treat an interrupted wait or a successful body as the driver's commit result.

### Decide what a publish failure means

A failed publish function runs after the transaction's data has committed. The default `onPublishFailure: "log"` logs an Error with its cause, channel name and change count, while preserving the committed result. This applies to an Effect failure, a defect and a synchronous throw from the publish function.

Set `onPublishFailure: "die"` when that same delivery failure should raise a defect. The data remains committed; this policy does not undo the write. Any retry policy belongs in the publish function.

### Capture notifications in tests

```ts
import type { Observation } from "@shivaedev/changes/observe.ts";
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

### Work inside the committing transaction

`makeChannel<A, R, E>` accepts an optional `beforeCommit: (changes: readonly A[]) => Effect<void, E, R>`. Its scoped `BeforeCommit` reference lets a binding replace that hook. `within` runs the hook after a successful body, with deduplicated changes from successful nested work, before the native root transaction commits. Empty transactions and rolled-back bodies do not run it. A typed hook failure is passed to the native transaction and rolls back the write. The hook does not run for an unframed record or a batch of already committed writes.

A direct driver binding using `open` must run `frame.beforeCommit` inside its transaction callback after the body succeeds, before returning to the driver. Then settle from the driver's actual commit result. `CommittedSink` optionally replaces the transaction's after-commit sink; the ordinary `Sink` still handles unframed records and batches. A PostgreSQL binding can use this to deliver through its listener once instead of also publishing locally after commit.

### API

Import from the module that defines the name; the package has no root entry.

| Module | Names |
| --- | --- |
| `channel.ts` | `makeChannel`, `ChannelOptions`, `Channel`, `BeforeCommit` |
| `frame.ts` | `Frame`, `CommitFrame`, `Outcome` |
| `observe.ts` | `Observation`, `Observer` |
| `publish.ts` | `Publish`, `PublishFailure` |

`key` is optional; for string changes, omitting it deduplicates repeated strings. A custom key is useful when a change is a structured description of an affected subject.

### Install, setup and limits

```sh
pnpm add @shivaedev/changes effect@4.0.5
```

`effect` is a peer dependency, so the application's Effect version runs the channel. The package declares Node 24 or newer. The SQL example also needs the application's native SQL driver and layer; neither the channel nor its installation creates a database connection or table.

- The channel is an in-process notification boundary. It has no persistent outbox, replay or cross-process transport; deployment delivery requires a separate design.
- Only explicitly recorded changes reach the channel. Trigger, cascade and raw SQL write discovery belongs to a binding or the application.
- A native adapter must observe the real commit outcome. Wrapping only the body of a transaction does not establish that outcome.
- Use a durable event design when every business event must be retained. A deduplicated notification is a request to refresh, not an event journal.
