# @shivaedev/effect-changes-prisma

Prisma applications need to announce changes after rows commit, even when a caller is interrupted or a transaction fails at COMMIT. This package binds Prisma Classic on PostgreSQL to effect-changes: returned model rows name changes, the transaction outcome decides when they publish, and tests can find written tables that no recorded change covers.

## Why you want this

Publishing from a write method can tell readers about rows that later roll back. Repeating a publication call after every transaction makes it easy to miss one. Put the meaning in a model map and use the same write path in each action:

```ts
const addMember = (id: string, ownerId: string, memberId: string) =>
  changes.use((db) => db.membership.create({ data: { id, ownerId, memberId } })).pipe(changes.transaction);
```

The binding named `changes` maps a membership row to its owner and member. This action publishes their changes after COMMIT; a rollback publishes nothing. Several writes in one action become one deduplicated batch, and a caller interrupted while COMMIT is in flight still gets its landed changes published.

## Using it

### How to think about it

Prisma Classic here means the generated Prisma Client API with interactive `$transaction` callbacks. The separate [effect-prisma package](https://github.com/ShivaeDev/platform/tree/main/packages/effect-prisma#readme) provides a database facade for Prisma Next.

A **change** is application data, such as `{ subject, domain }`. A **model map** turns a returned Prisma row into the changes it names; `null` classifies a model whose writes need no changes. A **binding** joins that map and a publication sink to a base Prisma client.

The binding's `Client` reference identifies the client for the current Effect scope. `use(query)` runs against that client and records mapped writes. `transaction(body)` provides Prisma's transaction client to the body and opens a **change frame**, a buffer of changes waiting for a transaction outcome. The `$transaction` promise settles that frame. The body finishing is not enough: the database can still reject COMMIT.

A nested binding transaction runs as a Prisma savepoint. Its successful frame merges into the parent and publishes with the parent; its failed frame is discarded. Outside a binding transaction or batch, a successful mapped write publishes after autocommit.

The work splits into three parts:

1. Once per application, define change data, bind the client and choose the sink.
2. Once per model or feature, define which changes its returned rows name.
3. In each action, run Prisma calls through `use` and wrap the action in `transaction`.

### 1. Bind the client and classify the models

```ts
import { makePrismaChanges } from "@shivaedev/effect-changes-prisma/changes.ts";
import type { ChangeMap } from "@shivaedev/effect-changes-prisma/model.ts";
import { Effect } from "effect";
import type { PrismaClient } from "./generated/client.ts";

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
```

This example has four Prisma models. A membership names both people; an audit note needs no publication. `satisfies ChangeMap<PrismaClient, Change>` checks the model names and scalar fields and requires every model to be classified. The binding also accepts a partial map; an absent model records nothing. `key` groups repeated changes for the same subject and domain into one entry in the published batch.

The application's generated client determines the models and row types. The client passed to `use` has the transaction-client type, so transaction-unavailable methods such as `$extends` are not offered there. The base client remains the binding's channel owner; providing a different current `Client` changes which client runs the calls.

### 2. Run an action through the binding

```ts
const saveOrder = (id: string, ownerId: string, total: number) =>
  Effect.gen(function* () {
    const order = yield* changes.use((db) => db.order.create({ data: { id, ownerId, total } }));
    yield* changes.use((db) => db.auditNote.create({ data: { id: `saved-${id}`, text: "saved" } }));
    return order;
  }).pipe(changes.transaction);
```

Both calls use the transaction client. The order records its owner's change; the audit note is classified as `null`. Publication happens after COMMIT and before `saveOrder` returns its row.

Use another `transaction` inside a body when a step needs its own savepoint:

```ts
import { Data } from "effect";

class Rejected extends Data.TaggedError("Rejected") {}

const saveWithOptionalMember = Effect.gen(function* () {
  yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } }));

  const member = yield* Effect.exit(
    Effect.andThen(
      changes.use((db) => db.membership.create({ data: { id: "m1", ownerId: "ada", memberId: "bob" } })),
      Effect.fail(new Rejected()),
    ).pipe(changes.transaction),
  );

  return member;
}).pipe(changes.transaction);
```

The failed member step rolls back its savepoint and discards its changes; the surrounding order can commit. A released savepoint's changes still disappear if its parent later rolls back.

### Returned rows and unnamed writes

Row-returning operations are `create`, `update`, `upsert`, `delete`, `createManyAndReturn` and `updateManyAndReturn`. The model mapping receives each returned row, so a single membership can name several subjects and a returned array can name changes from several rows.

Count-only `createMany`, `updateMany` and `deleteMany` on mapped models do not provide rows for the mapping. They record nothing and report `{ model, operation, reason: "countOnly" }` to `changes.Unnamed`, including when the count is zero. A returned row missing a field the mapping reads records nothing for that write and reports `reason: "narrowed"` with the field name.

```ts
import type { UnnamedWrite } from "@shivaedev/effect-changes-prisma/write.ts";

const unnamed: Array<UnnamedWrite> = [];

const updateWithoutOwner = changes
  .use((db) => db.order.update({ where: { id: "o1" }, data: { total: 20 }, select: { id: true } }))
  .pipe(
    changes.transaction,
    Effect.provideService(changes.Unnamed, (write) => Effect.sync(() => unnamed.push(write))),
  );
```

With the map above, this result lacks `ownerId`, so the observer receives `{ model: "Order", operation: "update", reason: "narrowed", field: "ownerId" }`. Reads, absent models and models classified as `null` record nothing.

For an existing application wrapper, feed its observed result into the same map:

```ts
const recordMembership = Effect.gen(function* () {
  yield* changes.recordWrite({
    model: "Membership",
    operation: "create",
    result: { ownerId: "ada", memberId: "bob" },
  });
});
```

`recordWrite` maps this row just as the automatic path does, including multiple subjects and unnamed-write reporting. Keep the call in the binding transaction that owns the write.

### Autocommitted writes and explicit batches

```ts
const saveInvoices = Effect.gen(function* () {
  yield* changes.use((db) => db.invoice.create({ data: { id: "i1", ownerId: "ada" } }));

  yield* changes.channel.batch(
    Effect.gen(function* () {
      yield* changes.use((db) => db.invoice.update({ where: { id: "i1" }, data: { ownerId: "bob" } }));
      yield* changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "bob", total: 1 } }));
    }),
  );
});
```

The first write publishes after autocommit. The explicit batch groups the two later writes into one publication. Use `transaction` for an action that needs a database transaction. The exposed `channel` is an [effect-changes channel](https://github.com/ShivaeDev/platform/tree/main/packages/effect-changes#readme); its sink and observer references are available for application wiring and tests.

### Transaction failures, interruption and timeouts

| Situation | Binding result |
| --- | --- |
| The body succeeds and COMMIT succeeds | Return the body's value and publish its batch. |
| The body fails with a typed error | Roll back, publish nothing and retain that error. |
| COMMIT fails a deferred constraint | Publish nothing and fail with `PrismaError`. |
| The caller is interrupted during the body | Interrupt the body, roll back and publish nothing. |
| The caller is interrupted during an in-flight COMMIT that lands | Publish after commit; the caller still sees interruption. |
| The body reaches its transaction timeout | Interrupt it, roll back, publish nothing and fail with `TransactionExpired`. |
| A query or nested transaction finds its enclosing transaction closed | Stop the body with `TransactionExpired`, even if the body ignores the query's failure. |
| A transaction cannot start before `maxWait` | Fail with `PrismaError`; do not classify it as an expired running transaction. |

```ts
const save = changes.transaction(
  changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 10 } })),
  { timeout: 10_000, maxWait: 2_000 },
);
```

Pass transaction options as the second argument. Without `timeout`, the binding uses the current client's configured transaction timeout; the tested Prisma default is 5,000 milliseconds. The configuration reader also handles an extended client. If that configuration cannot be read, it supplies no deadline of its own; a query finding the transaction closed still stops the body.

The deadline follows the wall clock, so moving Effect's `TestClock` does not expire the transaction. An outer transaction's expiry interrupts a nested body too. A separate transaction started on the base client, or another binding's transaction, has independent expiry; handling its failure can leave the original body's transaction running.

`use` waits for an in-flight successful write before recording it even when its caller is interrupted. The write may have committed, so interruption alone is not evidence that no change happened.

### Once per test harness: check written tables

The coverage check compares three things: tables PostgreSQL says the test wrote, changes the channel observed as `Recorded`, and writes that `Unnamed` could not name. The test supplies a `covers(model, change)` predicate because only the application knows whether a change represents that model.

Take a counter baseline at the start of the test's own transaction. A pooled connection can still hold earlier transaction counters; `writtenTables(tx, since)` reports tables whose counts grew after that baseline.

```ts
import { readFile } from "node:fs/promises";
import { checkCoverage, type CoverageViolation } from "@shivaedev/effect-changes-prisma/coverage.ts";
import { tablesOf, tableWrites, writtenTables } from "@shivaedev/effect-changes-prisma/tables.ts";
import type { Observation } from "@shivaedev/effect-changes/observe.ts";

const tables = tablesOf(await readFile("prisma/schema.prisma", "utf8"));
const domains: Readonly<Record<string, string>> = {
  Order: "orders",
  Membership: "memberships",
  Invoice: "invoices",
};

class TestRollback {
  readonly violations: ReadonlyArray<CoverageViolation>;

  constructor(violations: ReadonlyArray<CoverageViolation>) {
    this.violations = violations;
  }
}

const coverageOf = async <A, E>(body: Effect.Effect<A, E>) => {
  const observations: Array<Observation<Change>> = [];
  const unnamed: Array<UnnamedWrite> = [];

  return prisma.$transaction(async (tx) => {
    const since = await Effect.runPromise(tableWrites(tx));

    await Effect.runPromise(
      body.pipe(
        Effect.provideService(changes.Client, tx),
        Effect.provideService(changes.channel.Sink, () => Effect.void),
        Effect.provideService(changes.channel.Observer, (observation) => Effect.sync(() => observations.push(observation))),
        Effect.provideService(changes.Unnamed, (write) => Effect.sync(() => unnamed.push(write))),
      ),
    );

    const written = await Effect.runPromise(writtenTables(tx, since));
    throw new TestRollback(checkCoverage({
      written,
      tables,
      models,
      observations,
      unnamed,
      covers: (model, change) => domains[model] === change.domain,
    }));
  }).catch((error: unknown) => {
    if (error instanceof TestRollback) {
      return error.violations;
    }
    throw error;
  });
};
```

The harness provides its own transaction client and captures observations while the body runs. It replaces publication with a test sink, reads the counters before throwing `TestRollback`, and receives the coverage result after the database rolls back. Other failures are rethrown. In a test, assert that `await coverageOf(addMember("m1", "ada", "bob"))` equals `[]`.

A binding transaction inside this harness has no enclosing change frame until the application opens one. Its first savepoint frame is therefore a root and publishes on release, even though the harness later rolls back. The test sink prevents that publication from reaching the real bus.

`tablesOf` maps model declarations to table names, honoring `@@map("name")`, `@@map(name: "name")` and the model name when no mapping exists, while ignoring line comments. A caller can provide a table-to-model map directly instead.

`checkCoverage` returns:

- `Unrecorded` for each distinct written table without a covering `Recorded` change. A table with no model has `model: undefined`; a model classified as `null` is exempt.
- `Unnamed` for each distinct unnamed write, even when its table otherwise has a covering change.

`Recorded` changes still count if their savepoint later rolls back: PostgreSQL's counters include those writes. A `Published` observation alone does not establish coverage. Raw SQL writes without recorded changes are detected; read-only tables are not reported.

### API and module imports

Import the module that defines the name. There is no root entry point.

| Module | Exports for application use |
| --- | --- |
| `changes.ts` | `makePrismaChanges`, `PrismaChanges`, `PrismaChangesOptions`, `UnnamedObserver` |
| `model.ts` | `ChangeMap`, `ModelChanges`, `ModelName`, `ModelRow`, `RowOperation`, `CountOperation`, `Transactional`, `TransactionOptions` |
| `write.ts` | `Write`, `UnnamedWrite` |
| `coverage.ts` | `Coverage`, `CoverageViolation`, `checkCoverage` |
| `tables.ts` | `RawQueryClient`, `TableWrites`, `tablesOf`, `tableWrites`, `writtenTables` |
| `error.ts` | `PrismaError`, `TransactionExpired` |

`PrismaChangesOptions` takes `client`, `models` and the effect-changes channel options other than `owner` and `unowned`: `name`, `key`, `publish` and `onPublishFailure`. The binding returns `Client`, `channel`, `use`, `transaction`, `recordWrite` and `Unnamed`.

```ts
interface Write {
  readonly model: string;
  readonly operation: string;
  readonly result: unknown;
}

type UnnamedWrite =
  | { readonly model: string; readonly operation: string; readonly reason: "countOnly" }
  | { readonly model: string; readonly operation: string; readonly reason: "narrowed"; readonly field: string };

type CoverageViolation =
  | { readonly _tag: "Unrecorded"; readonly table: string; readonly model: string | undefined }
  | { readonly _tag: "Unnamed"; readonly write: UnnamedWrite };
```

These are the write input and the two diagnostic results. `Coverage<A>` takes `written`, `tables`, `models`, `observations`, `unnamed` and `covers`, as shown in the harness. `TableWrites` is a `ReadonlyMap<string, bigint>`; `RawQueryClient` requires `$queryRawUnsafe(query)`.

`use` has error type `PrismaError`. `transaction` adds `TransactionExpired | PrismaError` to the body's error type. `PrismaError` carries `cause`; `TransactionExpired` carries `message` and optional `cause`. Transaction options are `maxWait`, `timeout` and `isolationLevel`, whose type is `"ReadUncommitted" | "ReadCommitted" | "RepeatableRead" | "Serializable"`.

The module export pattern also exposes `model.ts`'s `rowOperations`, `countOperations` and `delegateOf`; `write.ts`'s `interpret`, `Interpreted`, `LooseChanges` and `LooseMap`; and the helpers in [`recording.ts`](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes-prisma/src/recording.ts), [`expiry.ts`](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes-prisma/src/expiry.ts) and [`transaction.ts`](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes-prisma/src/transaction.ts). Application examples use the binding API above.

### Install, setup and limits

```sh
pnpm add @shivaedev/effect-changes-prisma @shivaedev/effect-changes @prisma/client@7.10.0 effect@4.0.0-rc.112
```

`@prisma/client` and `effect` are peers. Generate and construct the application's Prisma Classic client for PostgreSQL before binding it. Package tests use the generated Prisma client and `@prisma/adapter-pg`; the PostgreSQL integration suite requires `PLATFORM_EFFECT_CHANGES_PRISMA_TEST_DATABASE_URL` and otherwise skips.

- Use the binding's `transaction` for the transaction outcome it observes, and `use` for automatically recorded model writes.
- Return the fields the model mapping needs. The count-only and missing-field diagnostics are part of coverage, not a way to infer omitted subjects.
- Coverage is a table-level check: one matching recorded change covers a written model's table. Test the correctness of affected subjects separately.
- A test harness's native rollback transaction can contain root binding savepoints that publish before the harness rolls back. Capture publication in tests that must not call a real external sink.

Read the [north star](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes-prisma/docs/north-star.md) for design boundaries and the [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/effect-changes-prisma/docs/roadmap.md) for status and open questions.
