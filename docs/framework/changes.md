# Commit-bound changes

Code that writes rows can announce what it changed so caches, subscriptions or
live views refresh. The announcement must follow the database: a change is
published after its transaction commits, once, and never for a rollback.
[`@shivaedev/effect-changes`](../../packages/effect-changes) provides that
boundary as a channel. It imports only `effect`, runs in browsers and servers,
and knows nothing about SQL or any ORM.

[`transact`](../../packages/effect-sql/README.md#transactions-and-invalidation)
in `@shivaedev/effect-sql` is a channel whose changes are Reactivity keys, over
`sql.withTransaction`, with `Reactivity.invalidate` as the sink.

## The channel

A channel has one sink and, per transaction owner, a stack of frames. A frame
buffers the changes recorded while it is open, deduplicated by key. Frames live
in a per-channel `Context.Reference`, so they travel with fiber context; there
is no global state and no AsyncLocalStorage.

```ts
const liveChanges = makeChannel<ChangeEvent, SqlClient.SqlClient>({
  name: "LiveChanges",
  owner: Effect.map(SqlClient.SqlClient, (sql) => sql.transactionService),
  key: (event) => `${event.userId}:${event.domain}`,
  publish: (events) => Effect.sync(() => events.forEach((event) => bus.emit(event))),
});

// one write, several subjects: a membership grant notifies owner and member
yield* liveChanges.record([
  { userId: owner, domain: "memberships" },
  { userId: member, domain: "memberships" },
]);
```

| Situation | Root frame (no enclosing frame for the owner) | Nested frame (savepoint) |
| --- | --- | --- |
| Body succeeds and the native transaction commits | Publish the distinct changes once, before returning | Merge into the parent in first-seen order |
| Typed failure, defect, interruption before `COMMIT`, failed `COMMIT` | Discard | Discard; the parent keeps its own changes |
| Interruption while `COMMIT` is in flight | Publish if the database committed; the caller still sees the interruption | Merge if released |
| `record` after the frame settled (a straggler fiber) | Die | Die |
| `record` with no frame for the owner | Run the `unowned` guard, then publish immediately | n/a |

- **Owners.** A frame for owner B opened inside a frame for owner A is a root
  for B and publishes when B commits, even if A rolls back later. Re-entering A
  inside B joins A's frame. Changes follow the owner that recorded them, not the
  innermost frame.
- **Keys.** `key` defaults to the change itself. The first occurrence of a key
  keeps its position; later ones are dropped, across merges too. Nothing assumes
  one change per write: `record` takes any iterable.
- **Batches.** `batch(body)` opens a non-transactional frame. Its writes were
  autocommitted, so it publishes on any exit. Transactions inside it merge into
  it when they commit. A batch inside a transaction merges into that transaction
  on any exit and shares its fate.
- **Guard.** `unowned` runs when a change is recorded, or a root frame opened,
  without a transaction frame for the owner. effect-sql uses it to refuse a
  native `sql.withTransaction` that `transact` did not open, because that
  commit cannot be observed.

## Binding a driver

`within(native)` wraps a combinator whose success means the database committed
or released the savepoint, such as `sql.withTransaction`. It runs the native
combinator uninterruptibly except for the body, so the settle decision sees the
real commit outcome. The body must run exactly once.

Drivers that report the commit through a Promise, such as Prisma's interactive
`$transaction`, use `open` and `settle`:

```ts
const frame = yield* liveChanges.open;
// run frame.provide(body) inside the driver's callback, e.g. with
// Effect.runPromiseExitWith(context), and await the driver's promise
yield* frame.settle(driverCommitted ? "committed" : "rolledBack");
```

`open` captures the caller's context; `settle` publishes with it. `settle` is
idempotent (the first outcome wins) and uninterruptible. If the caller can be
interrupted while the driver's promise is pending, keep waiting for the promise
and settle from its outcome, so a commit that lands after the interruption still
publishes.

[`@shivaedev/effect-changes-prisma`](../../packages/effect-changes-prisma) is
that binding for Prisma Classic on PostgreSQL only; see
[Prisma Classic](#prisma-classic).

## Prisma Classic

`makePrismaChanges` makes a channel whose owner is the base Prisma client and
adds three things around it:

- `transaction(body)` runs the body inside `$transaction` on the current client
  and settles its frame from `$transaction`'s promise. A nested `transaction`
  runs on the transaction client, so Prisma makes it a savepoint and its frame
  merges into the parent on release. A caller interrupted during the body
  interrupts the body, so Prisma rolls back; one interrupted while `COMMIT` is in
  flight waits for the outcome and publishes if the database committed. A body
  still running when the transaction's timeout passes, or whose query or nested
  `transaction` finds the transaction closed, is interrupted and the call fails
  with `TransactionExpired`, as does a `COMMIT` that finds it closed.
- `use(query)` runs a Prisma call against the current client and records the
  changes of every write it made to a mapped model, in the calling fiber. A
  typed map, `satisfies ChangeMap<PrismaClient, Change>` when it must classify
  every model, turns each returned row into any number of changes; `null`
  classifies a model whose writes publish nothing. Count-only `*Many` writes and
  results narrowed by `select` or `omit` cannot name their subjects, so they are
  reported to a test seam instead of recorded; rows are never read back.
- A coverage check for tests: `tableWrites` takes a baseline from
  `pg_stat_xact_user_tables` when the test's transaction starts, `writtenTables`
  reads the tables written since then just before it rolls back, `tablesOf` maps
  tables to models from `@@map`, and `checkCoverage` returns every table written
  without a covering `Recorded` observation and every unnamed write. It catches
  raw SQL, nested relation writes, cascades and triggers, which record nothing.
  It does not see a `TRUNCATE` inside the test transaction, which resets the
  transaction's counts to the baseline.

A test harness that runs each test inside a rolled-back Prisma transaction
provides that transaction as the binding's `Client` without opening a frame; the
application's first `transaction` is then a root and publishes when its
savepoint is released.

## Sink failures

By the time a sink runs, the rows are committed. A failing sink, whether a failed
Effect, a defect or a function that throws synchronously, is logged once as an
error with its full cause, the channel name and the change count, and the
caller's committed result stands. Turning it into a failure would invite
retries of writes that already landed. `onPublishFailure: "die"` raises a
defect instead. Retries belong in the sink.

## Testing seams

Both seams are `Context.Reference`s on the channel. Production code never
provides them, so it keeps the configured sink and runs no observer.

```ts
const published: Array<ChangeEvent> = [];
const captureSink = Layer.succeed(liveChanges.Sink, (events: ReadonlyArray<ChangeEvent>) =>
  Effect.sync(() => published.push(...events)),
);

const observations: Array<Observation<ChangeEvent>> = [];
const observeAll = Layer.succeed(liveChanges.Observer, (observation: Observation<ChangeEvent>) =>
  Effect.sync(() => observations.push(observation)),
);
```

- `Sink` replaces `publish` for everything in its scope, including frames
  settled later from that scope, instead of spying on the application's bus. The
  failure policy still applies.
- `Observer` receives `Recorded` for every accepted `record` call (its distinct
  changes), `Discarded` for every frame dropped by a rollback or failed commit
  (including changes merged into it from committed savepoints), and `Published`
  for what the sink receives. A change recorded in a rolled-back savepoint shows
  up as `Recorded` and `Discarded`, so a coverage check can count every write a
  test recorded, committed or not.

## Evidence

- [Core tests](../../packages/effect-changes/src) use a fake native transaction
  and cover merge and discard, stragglers, batches, concurrent `record`, owners,
  the guard, several subjects per write, idempotent `settle`, a Promise-shaped
  driver, both failure policies for failed, defective and throwing sinks, the
  sink override and the observer.
- [effect-sql PostgreSQL tests](../../packages/effect-sql/src/postgresTransact.spec.ts)
  repeat every SQLite `transact` case on PostgreSQL with two pools as distinct
  owners. [Commit-boundary tests](../../packages/effect-sql/src/transactCommit.spec.ts)
  hold `COMMIT` open with a deferred `pg_sleep` constraint trigger, interrupt the
  caller and compare the published keys with what a second pool sees committed;
  they also read from a separate pool inside the sink to show publishing happens
  after `COMMIT`, and show that a throwing subscriber is logged while the result
  and the rows stand. The interruption case fails against the previous
  `transact`, which dropped the keys.
- [Prisma Classic tests](../../packages/effect-changes-prisma/src) run a
  generated Prisma 7 client with `@prisma/adapter-pg` against PostgreSQL: a sink
  reading from a second client sees the committed rows, rollbacks, failed
  deferred commits and timeouts publish nothing, a body that outlives the
  timeout is interrupted before its next side effect, an interruption while a slow
  deferred trigger holds `COMMIT` still publishes, nested transactions merge and
  discard, one row names several subjects, `*Many` and narrowed writes are
  reported, and the coverage check finds a raw SQL insert and a table without a
  model among the tables a rolled-back transaction wrote.

## Limits

- Delivery is in-process. A crash between `COMMIT` and publishing loses the
  changes along with the in-process subscribers that would have received them.
- There is no cross-process delivery. PostgreSQL `NOTIFY` is itself
  commit-bound (delivered at `COMMIT`, dropped on rollback) and would be the
  transport for several processes, sent as the last statement before `COMMIT`.
  It is not implemented.
- Only recorded changes are published. Triggers, cascades and raw SQL that does
  not call `record` are invisible to the channel.
- Changes with equal keys are not merged; the first one wins.
