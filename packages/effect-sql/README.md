# @shivaedev/effect-sql

Small repositories over Effect's SQL client and schema models. The model supplies database codecs, insert/update variants, filter values and selected result types. No separate database interface, result schema or query-builder runtime is required.

```ts
import { Effect, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";

class InvoiceLine extends Model.Class<InvoiceLine>("InvoiceLine")({
  id: Model.Field({ select: Schema.Number, update: Schema.Number, json: Schema.Number }),
  name: Schema.String,
  amount: Schema.NumberFromString,
}) {}

const program = Effect.gen(function* () {
  const lines = yield* makeRepository(InvoiceLine, {
    tableName: "invoice_line",
    idColumn: "id",
    spanPrefix: "InvoiceLine",
  });
  yield* lines.insert({ name: "Consulting", amount: 52 });
  return yield* lines.findMany({
    where: { amount: 52 },
    select: ["name", "amount"],
    orderBy: { field: "name", direction: "asc" },
    limit: 20,
  });
  // Array<{ readonly name: string; readonly amount: number }>
});
```

Provide an Effect `SqlClient` Layer to run the program. The sample's database column for the amount is text; `NumberFromString` performs both directions of conversion. Schemas must match actual driver representations.

## Supported behavior

`insert`, `insertVoid`, `update`, `updateVoid`, `findById` and `delete` come directly from Effect's `SqlModel.makeRepository`. `findMany` adds conjunctions of equality filters, a nonempty tuple of selected fields, one sort field and a nonnegative integer limit. Omitted selection returns all declared fields. Returned lists contain decoded plain records; native CRUD returns the model class. Null filters compile to `IS NULL`. A filter key that is omitted or set to `undefined` leaves that field unconstrained. Values are bound parameters and identifiers use the native SQL identifier constructor.

Database-generated primary keys must remain in the update variant. The example uses `Model.Field` to express this; `Model.GeneratedByDb` alone omits the update key and therefore cannot be the native repository's id column. Native update expects the model's update shape, not an arbitrary partial patch. Native missing-row update behavior is retained: `update` defects when no row is returned, while `findById` fails with `NoSuchElementError`.

Field encoding, result decoding and SQL failures stay in Effect's error channel. A selected, filtered or sorted name that is not a model field fails with `SchemaError` before any SQL runs. Additional services required by field codecs stay in the effect environment. The repository uses its captured native client, so caller-owned `sql.withTransaction` scope is preserved. It does not introduce pools.

## Transactions and invalidation

`transact` wraps native `sql.withTransaction`, maps every `SqlError` through the caller's mapper, and announces changed Reactivity keys only after the outermost transaction commits:

```ts
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";

const save = (order: Order) =>
  Effect.gen(function* () {
    const saved = yield* orders.update(order);
    yield* invalidateOnCommit({ orders: [order.id] });
    return saved;
  }).pipe(transact({ onSqlError: () => new StorageUnavailable() }));
```

- Keys marked with `invalidateOnCommit` go into a set owned by the innermost `transact` on the same `SqlClient`. After the outermost commit, the set is passed once to `Reactivity.invalidate`. Keys use native Reactivity's form: an array, or a record expanded like `{ orders: [1] }` to `"orders"` and `"orders:1"`.
- A typed failure, defect or interruption before `COMMIT` rolls back; neither it nor a failed commit invalidates anything. A caller interrupted while `COMMIT` is in flight still invalidates if the database committed, and then sees the interruption. A nested `transact` on the same `SqlClient` uses a savepoint; its keys join the outer set only if it succeeds. A `transact` on a different `SqlClient` is its own top-level transaction with its own set, announced when that database commits, whatever the enclosing transaction does.
- Sets are kept per `SqlClient`. `invalidateOnCommit` adds its keys to the set of the `SqlClient` in its own context, not to the innermost `transact`: keys follow the database that wrote the rows, so they are announced when that database commits and dropped when it rolls back. Re-entering `transact` on a database whose transaction is still open further out (B inside A inside B) joins that transaction as a savepoint.
- The set closes when its `transact` finishes. A fiber forked inside the body that calls `invalidateOnCommit` afterwards dies instead of having its keys dropped; mark keys before the body returns.
- Outside any transaction, `invalidateOnCommit` invalidates immediately. Inside a native `sql.withTransaction` that `transact` does not own, both `transact` and `invalidateOnCommit` die, because the outer commit cannot be observed. Start the outermost transaction with `transact`.
- An invalidation that fails after `COMMIT`, such as a subscriber that throws, is logged as an error and the committed result is returned; the rows are committed either way.
- `Reactivity` is an in-process service. It does not deliver changes to other processes or browser clients.

`transact` is a channel from [`@shivaedev/effect-changes`](../effect-changes) over `sql.withTransaction`; see [commit-bound changes](../../docs/framework/changes.md) for the general mechanism.

Native SQLite leaves the connection inside the transaction when `COMMIT` itself fails (for example, a deferred foreign key); a later `BEGIN` on that connection fails. This is native `withTransaction` behavior; `transact` only guarantees that no invalidation is announced.

## Boundaries

The initial implementation is tested with Effect 4.0.0-rc.112, real in-memory SQLite and PostgreSQL. PostgreSQL coverage includes generated identities, field codecs, nullable filters, selected fields, ordering, limits, transaction rollback, and `transact` across savepoints, two pools, a failing deferred `COMMIT` and an interruption during `COMMIT`. Set `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL` to a disposable PostgreSQL database to run its integration tests; without it they are skipped. There is no SQL schema inference, migration generation, joins, relation loading, range predicates, tenant scoping or soft-delete policy. SQL table/column names must match the model fields and client transforms; migration authors remain responsible for that agreement. Use native Effect SQL for queries beyond this small API.

Further executable examples cover [PostgreSQL codecs](../../docs/framework/postgres-codecs.md), [constraint errors](../../docs/framework/constraint-errors.md) and [migration concurrency](../../docs/framework/postgres-migrations.md). These document the tested driver representations and their limits.
