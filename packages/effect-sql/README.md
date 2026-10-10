# @shivaedev/effect-sql

Describe a database row once with an Effect model and use it for writes, filters and decoded reads. Small repositories remove routine SQL work, while native transactions and migrations keep the database's ownership visible.

## Why you want this

A row type, an insert input, a filter type and a selected-result decoder can all disagree about the same field. This package takes them from the model, so a feature writes its query instead of maintaining another database interface:

```ts
const rows = yield* lines.findMany({
  where: { amount: 52, note: null },
  select: ["name", "amount"],
  orderBy: { field: "name", direction: "asc" },
  limit: 20,
});
```

`lines` is an invoice-line repository. Its model makes `amount` a number in application code even when the column stores text. This query filters with the number `52` and returns decoded records whose type contains only `name` and `amount`. The same model supplies writable inputs and database-generated IDs.

## Using it

### How to think about it

The application owns the database schema and its native Effect `SqlClient` layer. A **model** describes decoded row fields and the variants used for insertion, updating and JSON. A **repository** combines native `SqlModel` CRUD with a small `findMany` query whose filters and selected results use those fields.

A transaction is a separate boundary. Repository calls participate in a caller's native `sql.withTransaction`. When writes also announce changed Reactivity keys, start that boundary with `transact`: it uses the native transaction and records keys until its owning database commits. The change ownership comes from `effect-changes`; this package supplies the SQL boundary and the Reactivity publisher.

Migrations are ordinary Effects loaded by native Migrator. `migratePostgres` adds coordination for PostgreSQL runners sharing a ledger. It does not derive a table from a model: migration SQL and row codecs must agree.

The work has three parts: describe the model and provide its database once, choose repository operations per feature, and put each changed write inside the transaction that owns its commit.

### 1. Once per model: fields and writable variants

```ts
import { Effect, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";

class InvoiceLine extends Model.Class<InvoiceLine>("InvoiceLine")({
  amount: Schema.NumberFromString,
  id: Model.Field({
    select: Schema.Number,
    update: Schema.Number,
    json: Schema.Number,
  }),
  name: Schema.String,
  note: Schema.NullOr(Schema.String),
}) {}

const makeInvoiceLines = makeRepository(InvoiceLine, {
  tableName: "invoice_line",
  idColumn: "id",
  spanPrefix: "InvoiceLine",
});
```

The database supplies `id` on insert. Its `Model.Field` includes the ID in selected rows, updates and JSON, and leaves it out of insertion. Keep the repository's ID field in the update variant. An ordinary field such as `name` participates in the writable variants; native update takes that update shape, so pass the complete input the model requires.

`amount` uses a text column in this example. `Schema.NumberFromString` encodes a number for storage and decodes the driver's string on reads. The SQL schema still owns column types, constraints and defaults.

A generated creation time can have a different database and JSON representation:

```ts
const createdAt = Model.Field({
  select: Schema.Date,
  json: Schema.DateFromString,
});
```

This field is absent from insert and update. A PostgreSQL `timestamptz` default supplies a `Date` on the database boundary, while the JSON codec encodes a string. Choose each field's schema for the values its driver or transport actually returns.

### 2. Per feature: write and query through the model

```ts
const reviseInvoiceLine = Effect.gen(function* () {
  const lines = yield* makeInvoiceLines;
  const inserted = yield* lines.insert({
    amount: 52,
    name: "Consulting",
    note: null,
  });
  const updated = yield* lines.update({
    ...inserted,
    amount: 55,
    name: "Onsite consulting",
  });
  const found = yield* lines.findById(updated.id);
  yield* lines.delete(found.id);
  return yield* lines.findMany({ where: { id: found.id } });
});
```

`insert` returns an `InvoiceLine` with the generated ID and decoded amount. The update supplies the model's required fields, the by-ID read reaches the saved row, and the final query returns an empty list after deletion. These methods come from native `SqlModel.makeRepository`; `findMany` is the added query.

For lists, choose the fields the caller needs:

```ts
const listInvoiceLines = (name: string | undefined) =>
  Effect.gen(function* () {
    const lines = yield* makeInvoiceLines;
    return yield* lines.findMany({
      where: { amount: 52, name, note: null },
      select: ["name", "amount"],
      orderBy: { field: "name", direction: "desc" },
      limit: 20,
    });
  });
```

The filters are equality conditions joined together. A null filter matches SQL `NULL`; an omitted or `undefined` value leaves the field unconstrained. Filters use decoded field values, so `amount` takes a number. Selected results are decoded records with the selected fields' types; this function returns `Array<{ readonly name: string; readonly amount: number }>`.

`select` is a nonempty tuple of model field names. Leave it out to select all model fields. `orderBy` takes one field and `asc` or `desc`; `limit` takes a nonnegative integer, and zero returns an empty list. Unknown selected or sorted field names passed at runtime fail with `SchemaError`, as do unknown filter keys with a defined value. Filter entries with `undefined` values are omitted before field validation. Use native SQL and composed schemas for joins, aggregates, range filters or other queries outside this shape.

If a field codec requires a service, provide it for the query. Filter encoding and selected-row decoding retain their required services in the Effect environment.

### Transactions and invalidation

```ts
import { Data } from "effect";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";

class StorageUnavailable extends Data.TaggedError("StorageUnavailable")<{
  readonly reason: string;
}> {}

const saveInvoiceLine = (input: typeof InvoiceLine.update.Type) =>
  Effect.gen(function* () {
    const lines = yield* makeInvoiceLines;
    const saved = yield* lines.update(input);
    yield* invalidateOnCommit({ invoiceLines: [saved.id] });
    return saved;
  }).pipe(
    transact({
      onSqlError: (error) => new StorageUnavailable({ reason: error.message }),
    }),
  );
```

`transact` wraps native `sql.withTransaction`. It maps typed `SqlError` failures through `onSqlError` and keeps other typed failures and service requirements. `invalidateOnCommit` records the readers' keys; after the owning outermost commit, they are deduplicated and passed to native `Reactivity.invalidate` once. The record `{ invoiceLines: [1] }` marks `"invoiceLines"` and `"invoiceLines:1"`. An array such as `["invoiceLines:1"]` marks only those keys.

The transaction rules follow the database owner:

- A typed failure or interruption before commit rolls back and announces nothing. A failed deferred `COMMIT` also announces nothing.
- A nested `transact` on the same client uses a native savepoint. Its successful keys join the outer set; a rolled-back savepoint's keys are discarded.
- A transaction on a second client commits independently. Its keys publish when that client commits, even if the enclosing client's transaction later rolls back.
- Keys belong to the `SqlClient` in the recording Effect's context. Entering another client's transaction does not move an existing client's keys. Re-entering a still-open transaction on the original client joins its own savepoint.
- Recording from a fiber after its transaction finishes dies. Record every changed key before the body returns.

Begin the outermost changed transaction with `transact`. Both `transact` and `invalidateOnCommit` refuse a native outer `sql.withTransaction` they do not own, because they cannot observe its commit. Outside a transaction, `invalidateOnCommit` publishes immediately.

PostgreSQL commit visibility decides publication even when a caller is interrupted while `COMMIT` is in flight: if the database commits, keys publish and the caller remains interrupted. If invalidation itself fails after commit, the failure is logged and the committed result stands. Do not treat a notification failure as evidence that the write can be retried safely.

For the generic ownership mechanism, read [commit-bound changes](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md). Reactivity keys are local reader invalidation; an application's cross-process or browser delivery belongs at its delivery boundary.

### PostgreSQL migrations: numbered SQL Effects

```ts
import { Migrator, SqlClient } from "effect/unstable/sql";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";

const migrateOrders = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* migratePostgres({
    table: "app_migrations",
    lockTimeout: "5 seconds",
    loader: Migrator.fromRecord({
      "1_create_orders": sql`create table orders (name text primary key)`.pipe(
        Effect.asVoid,
      ),
      "2_seed_orders": sql`insert into orders (name) values ('Printer paper')`.pipe(
        Effect.asVoid,
      ),
    }),
  });
});
```

The first run returns `[[1, "create_orders"], [2, "seed_orders"]]`. Repeating the loader returns `[]`; adding a higher numbered migration applies the new work. Treat applied migrations as immutable and append increasing IDs.

`migratePostgres` takes a transaction-scoped advisory lock before creating the ledger and running native Migrator. Concurrent runners on a fresh or existing ledger wait, then see the committed ledger and avoid repeating the migrations. Every runner of that ledger must use this helper and the same ledger name. The required `lockTimeout` bounds PostgreSQL lock waits; `Duration.infinity` sets the transaction's lock timeout to zero. Choose deployment and execution timeouts in the application.

A failed batch rolls back its DDL, data and ledger entries, retaining previously committed migrations. A failed first batch also rolls back the bootstrapped ledger. A lock timeout fails with typed `SqlError` and reason `LockTimeoutError`; a migration-body SQL failure is a native `MigrationError` defect. Inspect startup completion with `Effect.exit` when both typed failures and defects matter.

### API

Import the module that defines the name; there is no root entry.

| Module | Export | Input or role |
| --- | --- | --- |
| `@shivaedev/effect-sql/repository.ts` | `makeRepository(model, options)` | `tableName`, `idColumn`, `spanPrefix`; requires native `SqlClient`. |
| `@shivaedev/effect-sql/repository.ts` | `FindMany` | Query options derived from the model's fields. |
| `@shivaedev/effect-sql/transact.ts` | `transact(effect, options)` or `effect.pipe(transact(options))` | Required `onSqlError` mapper; requires `SqlClient` and `Reactivity`. |
| `@shivaedev/effect-sql/transact.ts` | `TransactOptions` | The typed SQL-error mapper. |
| `@shivaedev/effect-sql/transact.ts` | `invalidateOnCommit(keys)` | Records keys for its client, or invalidates immediately outside a transaction. |
| `@shivaedev/effect-sql/transact.ts` | `InvalidationKeys` | A readonly array, or a record of readonly ID arrays. |
| `@shivaedev/effect-sql/migrations.ts` | `migratePostgres(options)` | Native loader, required `lockTimeout`, optional ledger `table`, default `effect_sql_migrations`. |
| `@shivaedev/effect-sql/migrations.ts` | `PostgresMigrationOptions` | Loader environment and migration coordination options. |

The repository's native methods keep the model's variants. For the `InvoiceLine` example:

| Method | Input type | Success type |
| --- | --- | --- |
| `insert` | `typeof InvoiceLine.insert.Type` | `InvoiceLine` |
| `insertVoid` | `typeof InvoiceLine.insert.Type` | `void` |
| `update` | `typeof InvoiceLine.update.Type` | `InvoiceLine` |
| `updateVoid` | `typeof InvoiceLine.update.Type` | `void` |
| `findById` | `number` | `InvoiceLine` |
| `delete` | `number` | `void` |
| `findMany` | `FindMany<typeof InvoiceLine, SelectedField>` | Array of decoded selected records |

### Install and database setup

```sh
pnpm add @shivaedev/effect-sql effect@4.0.0-rc.112 @effect/sql-pg@4.0.0-rc.112
```

`effect` is a peer. Install the native driver your application uses; this command chooses PostgreSQL. Provide its layer, and provide native Reactivity when using `transact` or `invalidateOnCommit`:

```ts
import * as PgClient from "@effect/sql-pg/PgClient";
import { Layer, Redacted } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";

const database = Layer.merge(
  PgClient.layer({ url: Redacted.make("postgresql://localhost/example") }),
  Reactivity.layer,
);

const save = saveInvoiceLine({
  id: 1,
  name: "Consulting",
  amount: 52,
  note: null,
}).pipe(Effect.provide(database));
```

The application's startup runs migrations and keeps its database scope alive for the services that use it. The example assumes the table and row exist. Models describe expected data; they do not create tables or establish authorization policy.

### Errors and storage limits

Query decoding and invalid limits can fail with `SchemaError`; SQL statement failures remain `SqlError`. Native `findById` adds `NoSuchElementError` for a missing row, while native `update` defects if it returns no row. Commit failures can also be native defects; `onSqlError` maps the typed error channel, not those defects.

Map a known constraint at the operation that understands it, after the transaction has rolled back:

```ts
import type { SqlError } from "effect/unstable/sql/SqlError";

class NameTaken extends Data.TaggedError("NameTaken") {}

const knownNameConflict = (error: SqlError): Effect.Effect<never, NameTaken | SqlError> =>
  error.reason._tag === "UniqueViolation" &&
  error.reason.constraint === "invoice_line_name_key"
    ? Effect.fail(new NameTaken())
    : Effect.fail(error);

const insertNamedLine = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const lines = yield* makeInvoiceLines;
  return yield* sql
    .withTransaction(lines.insert({ amount: 52, name: "Consulting", note: null }))
    .pipe(Effect.catchTag("SqlError", knownNameConflict));
});
```

The migration owns the constraint name `invoice_line_name_key`. The mapper recognizes that named unique violation and keeps other failures intact. Put recovery outside the transaction so earlier writes in the operation roll back too. Domain error presentation belongs to the application.

PostgreSQL tests use the native driver's default representations: precise numeric strings with `Schema.BigDecimalFromString`, dates with `Schema.Date`, ordinary JSON/JSONB objects with object schemas, nullable text and generated values. A persisted JSON value that violates its schema fails decoding; a write and read inside the enclosing transaction roll back together when that failure escapes.

With the default PostgreSQL date parser, `timestamptz` preserves an instant at millisecond precision; `timestamp without time zone` is interpreted as local wall time in the Node process timezone. A model cannot recover microseconds the driver has discarded. See [PostgreSQL codec cases and limits](https://github.com/ShivaeDev/platform/blob/main/docs/framework/postgres-codecs.md) before choosing a storage representation.

Migration rollback evidence covers transactional table DDL and writes. Nontransactional DDL, external side effects, crash recovery and deployment compatibility need their own policy and tests. Checksums, edited applied migrations and larger query APIs are open questions in [the package roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/docs/roadmap.md).

The package's PostgreSQL tests require a disposable database through `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL` and skip without it. SQLite fixtures establish the SQLite cases; type tests establish compile-time contracts. Neither substitutes for a PostgreSQL run. Public composed repository consumers live in the framework's [order example](https://github.com/ShivaeDev/platform/blob/main/docs/framework/order-example.md); they establish fixture behavior, not application adoption.
