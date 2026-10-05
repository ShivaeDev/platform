# @shivaedev/effect-changes-prisma

Commit-bound change channels for Prisma Classic (`@prisma/client` with interactive `$transaction`). Writes to mapped models record their changes automatically; the changes publish once, deduplicated, after the transaction commits, and never for a rollback. A test-time coverage check reports writes that no recorded change accounts for.

It works with PostgreSQL only. The coverage check reads PostgreSQL's `pg_stat_xact_user_tables`, `isolationLevel` takes the levels Prisma accepts on PostgreSQL, and every test runs against PostgreSQL.

It binds a [`@shivaedev/effect-changes`](../effect-changes) channel to Prisma: the channel semantics (owners, savepoint merge and discard, batches, sink failures, test seams) are the same, see [commit-bound changes](../../docs/framework/changes.md).

```ts
import type { ChangeMap } from "@shivaedev/effect-changes-prisma/model.ts";
import { makePrismaChanges } from "@shivaedev/effect-changes-prisma/changes.ts";
import { Effect } from "effect";
import { PrismaClient } from "./generated/client.ts";

interface Change {
  readonly subject: string;
  readonly domain: string;
}
declare const prisma: PrismaClient;
declare const bus: { readonly emit: (change: Change) => void };

const models = {
  Order: (order) => [{ subject: order.ownerId, domain: "orders" }],
  Membership: (membership) => [
    { subject: membership.ownerId, domain: "memberships" },
    { subject: membership.memberId, domain: "memberships" },
  ],
  Invoice: (invoice) => [{ subject: invoice.ownerId, domain: "invoices" }],
  AuditNote: null,
} satisfies ChangeMap<PrismaClient, Change>;

const changes = makePrismaChanges({
  name: "LiveChanges",
  client: prisma,
  models,
  key: (change) => `${change.subject}:${change.domain}`,
  publish: (batch: ReadonlyArray<Change>) => Effect.sync(() => batch.forEach((change) => bus.emit(change))),
});

const addMember = (id: string, ownerId: string, memberId: string) =>
  changes.use((db) => db.membership.create({ data: { id, ownerId, memberId } })).pipe(changes.transaction);
```

## API

```ts
makePrismaChanges<Tx extends Transactional<Tx>, A, R = never>(options: PrismaChangesOptions<Tx, A, R>): PrismaChanges<Tx, A, R>

interface PrismaChangesOptions<Tx, A, R> extends Omit<ChannelOptions<A, R>, "owner" | "unowned"> {
  readonly client: Tx & Transactional<Tx>;
  readonly models: Partial<ChangeMap<Tx, A>>;
}

interface PrismaChanges<Tx, A, R> {
  readonly channel: Channel<A, R>;
  readonly Client: Context.Reference<Tx>;
  readonly use: <X>(query: (client: Tx) => PromiseLike<X>) => Effect<X, PrismaError, R>;
  readonly transaction: <X, E, R2>(body: Effect<X, E, R2>, options?: TransactionOptions) => Effect<X, E | TransactionExpired | PrismaError, R | R2>;
  readonly recordWrite: (write: Write) => Effect<void, never, R>;
  readonly Unnamed: Context.Reference<(write: UnnamedWrite) => Effect<void>>;
}

type ChangeMap<Client, A> = { readonly [Model in ModelName<Client>]: ((row: ModelRow<Client, Model>, operation: RowOperation) => Iterable<A>) | null };
type RowOperation = "create" | "update" | "upsert" | "delete" | "createManyAndReturn" | "updateManyAndReturn";
type UnnamedWrite =
  | { readonly model: string; readonly operation: string; readonly reason: "countOnly" }
  | { readonly model: string; readonly operation: string; readonly reason: "narrowed"; readonly field: string };
class PrismaError { readonly _tag: "PrismaError"; readonly cause: unknown }
class TransactionExpired { readonly _tag: "TransactionExpired"; readonly message: string; readonly cause?: unknown }

tablesOf(schema: string): ReadonlyMap<string, string>
tableWrites(client: RawQueryClient): Effect<TableWrites, PrismaError>
writtenTables(client: RawQueryClient, since?: TableWrites): Effect<ReadonlyArray<string>, PrismaError>
checkCoverage<A>(coverage: Coverage<A>): ReadonlyArray<CoverageViolation>
```

- `client` is the base client, usually a `PrismaClient`, or one you extended. `Tx` is inferred as the client its `$transaction` callback receives. The channel's owner is this client, so frames are kept per database.
- `Client` holds the client for the current scope: the base client, or the transaction client inside `transaction`. Resolve it here if your own code calls Prisma, and provide it to run code against a transaction you opened yourself.
- `use(query)` runs `query` against the current client and records every successful write it made to a mapped model, in the calling fiber: into the enclosing transaction's frame, into a `channel.batch`, or published at once when there is neither, because the write autocommitted. It waits for Prisma's promise, which cannot be cancelled, so a write is recorded if and only if it ran. A rejection fails with `PrismaError`.
- `transaction(body)` runs `body` inside `$transaction` on the current client. Inside another `transaction`, Prisma makes it a savepoint and its changes merge into the parent when it is released.
- `recordWrite` applies the map to a write you observed yourself, for applications that already wrap Prisma in their own Effect client.
- `models` maps each model name to the changes one row names, or to `null` for models whose writes publish nothing. `satisfies ChangeMap<PrismaClient, A>` makes a model added to the schema a type error until it is classified; a `Partial` map is accepted when you do not want that.

## Transactions

`transaction` opens a frame with `channel.open` in the caller's fiber, runs the body with `Effect.runPromiseExitWith` inside the `$transaction` callback, and settles the frame from the outcome of `$transaction`'s promise, not from the body:

| Situation | Result |
| --- | --- |
| `$transaction` cannot start, for example because no connection frees up within `maxWait` | The body never runs; fail with `PrismaError`, even though Prisma reports it as `P2028` |
| The body succeeds and `$transaction` resolves | Publish once, before `transaction` returns; a savepoint merges into its parent |
| The body fails, dies or is interrupted | Prisma rolls back; discard; the body's failure is returned unchanged |
| The body is still running when the transaction's timeout passes | The body is interrupted at its next step; a query already in flight completes first. Prisma rolls back; discard; fail with `TransactionExpired` |
| A query or a nested `transaction` in the body fails because the transaction is already closed | The body is stopped, whatever it does with the error; discard; fail with `TransactionExpired` |
| The body succeeds but `COMMIT` finds the transaction closed | Discard; fail with `TransactionExpired` |
| The body succeeds but `COMMIT` fails for another reason | Discard; fail with `PrismaError` |
| The caller is interrupted while the body runs | The body is interrupted, Prisma rolls back, nothing publishes |
| The caller is interrupted while `COMMIT` is in flight | Keep waiting; publish if the database committed; the caller still sees the interruption |

The timeout is the `timeout` option, otherwise the one Prisma applies to the current client, extended or not: its `transactionOptions.timeout`, 5 seconds unless the client was constructed with another. Like Prisma's, the clock starts once the transaction has begun, and it reads wall-clock time, so a `TestClock` does not move it. A `transaction` running on a transaction client, which Prisma makes a savepoint, has no timeout of its own; the outer transaction's applies. On any other client, such as a per-request extended client or the base client provided inside a body, `transaction` starts a separate transaction with its own timeout, and that transaction closing does not stop the body it runs in. Prisma reports a closed transaction as `P2028`, for example when a test harness's own transaction, which `transaction` does not time, has expired.

A frame is a root when there is no frame for the client further out, not when the current client is the base client. A test harness can therefore run each test inside a Prisma transaction that always rolls back, provide its transaction client as `Client` without opening a frame, and the application's first `transaction` inside it publishes when its savepoint is released.

## Recording

- Row-returning writes (`create`, `update`, `upsert`, `delete`, `createManyAndReturn`, `updateManyAndReturn`) pass each returned row to the model's mapping. One row may name any number of changes, for example one per subject.
- `createMany`, `updateMany` and `deleteMany` return only a count, so they cannot name their subjects. They record nothing and are reported to `Unnamed` as `countOnly`; the coverage check turns them into violations. Use a single-row or `*AndReturn` write on mapped models. Rows are never read back.
- A mapping that reads a field the write did not return, because `select` or `omit` narrowed the result, records nothing for that write; it is reported to `Unnamed` as `narrowed` with the field's name.
- Reads, raw queries and models mapped to `null` or absent from the map record nothing.

## Coverage check

The check runs in tests. Take a baseline from `pg_stat_xact_user_tables` when the test transaction starts, read the tables written since just before it rolls back, then compare them with the changes the channel observed:

```ts
const tables = tablesOf(await readFile("prisma/schema.prisma", "utf8"));
const observations: Array<Observation<Change>> = [];
const unnamed: Array<UnnamedWrite> = [];
// first, as the test transaction starts:
const since = yield* tableWrites(testTransaction);
// run the test with changes.channel.Observer and changes.Unnamed pushing into those arrays,
// and changes.Client set to the test's transaction client; then, before rolling back:
const written = yield* writtenTables(testTransaction, since);
const violations = checkCoverage({
  written,
  tables,
  models,
  observations,
  unnamed,
  covers: (model, change) => domains[model] === change.domain,
});
```

- `tablesOf` reads the table of every model from Prisma schema text, honouring `@@map`; a model without it uses its name. Pass an explicit `Map` instead if your tables come from elsewhere.
- `tableWrites(client)` and `writtenTables(client, since)` must run on the test's own transaction. PostgreSQL counts inserted, updated and deleted rows, including rows written in savepoints that rolled back, but it keeps those counters per connection until it flushes them, at most once a second. On a pooled connection they still hold the writes of earlier transactions, so `writtenTables` reports only the tables whose counters grew past the `since` baseline. Without `since` it reports every table with an unflushed count. The binding cannot take the baseline for you: the test transaction is the harness's own `$transaction`, which it never sees begin.
- `checkCoverage` is a pure function and throws only if `covers` throws. It reports each written table whose model is not mapped to `null` and for which no `Recorded` observation satisfies `covers`, as `Unrecorded` (with `model: undefined` when no model owns the table), and each distinct unnamed write as `Unnamed`. `Recorded` includes changes whose frame was later discarded, matching the statistics.
- Raw SQL, relation writes nested in `data`, cascades and triggers write tables that nothing records; the check is how they surface. Filter the result if a table is written legitimately without a change.

## Limits

- The client handed to `use` wraps write methods of mapped models, so their results are plain promises: pass them to `transaction`, not to the array form of `$transaction`, and do not chain fluent relation calls on them. Calling `$transaction` on that client runs outside the binding; use `transaction`.
- A relation write nested in `data` records only the top-level model.
- Prisma's interactive transaction timeout (5 seconds by default) still applies; pass `{ timeout }` to `transaction` for a longer one.
- The client's timeout is read from Prisma's internal client configuration, which Prisma `7.10.0` keeps on the client. If a later Prisma moves it, `transaction` sets no deadline of its own, and a body that outlives Prisma's timeout stops at its first query after the transaction closes; pass `{ timeout }` to have it interrupted on time.
- `checkCoverage` matches tables by name, not by schema.
- `writtenTables` does not see a `TRUNCATE` inside the test transaction: `TRUNCATE` resets the transaction's insert, update and delete counts in `pg_stat_xact_user_tables`, so they fall back to the baseline, and a table that was written and then truncated counts as unwritten.
- Delivery is in-process, as for every effect-changes channel.

Tested with Prisma `7.10.0` and `@prisma/adapter-pg` on PostgreSQL 18, and Effect `4.0.0-rc.112`.
