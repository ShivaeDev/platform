# @shivaedev/effect-changes-prisma

Commit-bound change channels for Prisma Classic (`@prisma/client` with interactive `$transaction`). Writes to mapped models record their changes automatically; the changes publish once, deduplicated, after the transaction commits, and never for a rollback. A test-time coverage check reports writes that no recorded change accounts for.

It binds a [`@shivaedev/effect-changes`](../effect-changes) channel to Prisma: the channel semantics (owners, savepoint merge and discard, batches, sink failures, test seams) are the same, see [commit-bound changes](../../docs/framework/changes.md).

```ts
import { type ChangeMap, makePrismaChanges } from "@shivaedev/effect-changes-prisma";
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
  readonly transaction: <X, E, R2>(body: Effect<X, E, R2>, options?: TransactionOptions) => Effect<X, E | PrismaError, R | R2>;
  readonly recordWrite: (write: Write) => Effect<void, never, R>;
  readonly Unnamed: Context.Reference<(write: UnnamedWrite) => Effect<void>>;
}

type ChangeMap<Client, A> = { readonly [Model in ModelName<Client>]: ((row: ModelRow<Client, Model>, operation: RowOperation) => Iterable<A>) | null };
type RowOperation = "create" | "update" | "upsert" | "delete" | "createManyAndReturn" | "updateManyAndReturn";
type UnnamedWrite =
  | { readonly model: string; readonly operation: string; readonly reason: "countOnly" }
  | { readonly model: string; readonly operation: string; readonly reason: "narrowed"; readonly field: string };
class PrismaError { readonly _tag: "PrismaError"; readonly cause: unknown }

tablesOf(schema: string): ReadonlyMap<string, string>
writtenTables(client: RawQueryClient): Effect<ReadonlyArray<string>, PrismaError>
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
| The body succeeds and `$transaction` resolves | Publish once, before `transaction` returns; a savepoint merges into its parent |
| The body fails, dies or is interrupted | Prisma rolls back; discard; the body's failure is returned unchanged |
| The body succeeds but `COMMIT` fails, the transaction times out or cannot start | Discard; fail with `PrismaError` |
| The caller is interrupted while the body runs | The body is interrupted, Prisma rolls back, nothing publishes |
| The caller is interrupted while `COMMIT` is in flight | Keep waiting; publish if the database committed; the caller still sees the interruption |

A frame is a root when there is no frame for the client further out, not when the current client is the base client. A test harness can therefore run each test inside a Prisma transaction that always rolls back, provide its transaction client as `Client` without opening a frame, and the application's first `transaction` inside it publishes when its savepoint is released.

## Recording

- Row-returning writes (`create`, `update`, `upsert`, `delete`, `createManyAndReturn`, `updateManyAndReturn`) pass each returned row to the model's mapping. One row may name any number of changes, for example one per subject.
- `createMany`, `updateMany` and `deleteMany` return only a count, so they cannot name their subjects. They record nothing and are reported to `Unnamed` as `countOnly`; the coverage check turns them into violations. Use a single-row or `*AndReturn` write on mapped models. Rows are never read back.
- A mapping that reads a field the write did not return, because `select` or `omit` narrowed the result, records nothing for that write; it is reported to `Unnamed` as `narrowed` with the field's name.
- Reads, raw queries and models mapped to `null` or absent from the map record nothing.

## Coverage check

The check runs in tests. Read the tables the test transaction wrote from `pg_stat_xact_user_tables` just before it rolls back, then compare them with the changes the channel observed:

```ts
const tables = tablesOf(await readFile("prisma/schema.prisma", "utf8"));
const observations: Array<Observation<Change>> = [];
const unnamed: Array<UnnamedWrite> = [];
// run the test with changes.channel.Observer and changes.Unnamed pushing into those arrays,
// and changes.Client set to the test's transaction client; then, before rolling back:
const written = yield* writtenTables(testTransaction);
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
- `writtenTables(client)` must run on the test's own transaction: PostgreSQL counts inserted, updated and deleted rows per transaction, including rows written in savepoints that rolled back.
- `checkCoverage` is a pure function and never throws. It reports each written table whose model is not mapped to `null` and for which no `Recorded` observation satisfies `covers`, as `Unrecorded` (with `model: undefined` when no model owns the table), and each distinct unnamed write as `Unnamed`. `Recorded` includes changes whose frame was later discarded, matching the statistics.
- Raw SQL, relation writes nested in `data`, cascades and triggers write tables that nothing records; the check is how they surface. Filter the result if a table is written legitimately without a change.

## Limits

- The client handed to `use` wraps write methods of mapped models, so their results are plain promises: pass them to `transaction`, not to the array form of `$transaction`, and do not chain fluent relation calls on them. Calling `$transaction` on that client runs outside the binding; use `transaction`.
- A relation write nested in `data` records only the top-level model.
- Prisma's interactive transaction timeout (5 seconds by default) still applies; pass `{ timeout }` to `transaction`.
- `checkCoverage` matches tables by name, not by schema.
- Delivery is in-process, as for every effect-changes channel.

Tested with Prisma `7.9.1` and `@prisma/adapter-pg` on PostgreSQL 18, and Effect `4.0.0-rc.112`.
