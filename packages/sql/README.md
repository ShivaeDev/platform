# @shivaedev/sql

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

The application owns the database schema and its native Effect `SqlClient` layer. Configure new clients with `clientOptions` to map camelCase model fields to snake_case PostgreSQL columns. A **model** describes decoded row fields and the variants used for insertion, updating and JSON. A **repository** combines native `SqlModel` CRUD with a small `findMany` query whose filters and selected results use those fields.

Repository writes announce their table and returned row keys automatically. A single write returning more than 1,000 rows across all its chunks announces only the table and `<table>:*`; writes returning up to 1,000 rows keep their item keys. Effect-contract item reads also react to the collection-wide key. Each write uses `transact`; start a surrounding multi-write boundary with `transact` too, so keys leave only after its owning database commits. Bare native transactions are refused because their commit cannot be observed. The change ownership comes from `changes`; this package supplies the SQL boundary and the Reactivity publisher.

Migrations are ordinary Effects loaded by native Migrator. `migratePostgres` adds coordination for PostgreSQL runners sharing a ledger. It does not derive a table from a model: migration SQL and row codecs must agree.

The work has three parts: describe the model and provide its database once, choose repository operations per feature, and put each changed write inside the transaction that owns its commit.

### SQL names: configure the client once

```ts
import * as PgClient from "@effect/sql-pg/PgClient";
import { Redacted } from "effect";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";

const database = PgClient.layer(clientOptions({
  url: Redacted.make("postgresql://localhost/example"),
}));
```

`clientOptions` enables Effect SQL's `transformQueryNames` with Effect's `String.camelToSnake` and `transformResultNames` with `String.snakeToCamel` by default. A model field `createdAt` writes the migration-created `created_at` column, and returned rows contain `createdAt`. Inserts, selects, filters, ordering, updates and raw SQL share the client's transforms; column aliases are unnecessary. Write literal migration SQL with snake_case columns. In tagged SQL, interpolated identifiers such as `sql("createdAt")` are transformed; literal SQL text stays as written.

To opt out for an existing database with quoted camelCase columns or models with snake_case fields, use `PgClient.layer(clientOptions(options, { snakeCase: false }))`. Existing native clients are unchanged until configured with this helper. Native `transformQueryNames` and `transformResultNames` supplied in `options` take precedence. For `platform`'s `appHost` or `appDatabase`, use `clientOptions` on their `config` object; the host forwards those native transforms to its client.

### 1. Once per model: fields and writable variants

```ts
import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { makeRepository } from "@shivaedev/sql/repository.ts";

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

For a PostgreSQL `int4[]` column, give the native driver an explicit element OID so an empty array has a type too:

```ts
import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Result, SchemaGetter, SchemaParser } from "effect";

const Integers = Schema.Array(Schema.Int);
const StoredIntegers = Schema.Unknown.pipe(
  Schema.decodeTo(Integers, {
    decode: SchemaGetter.transformEffect((value) =>
      SchemaParser.decodeUnknownEffect(Integers)(PgTypes.isParameter(value) ? value.value : value),
    ),
    encode: SchemaGetter.transform((values) => Result.getOrThrow(PgTypes.array(values, PgTypes.OID.int4))),
  }),
);

class Sample extends Model.Class<Sample>("Sample")({
  id: Schema.Int,
  values: Model.Field({ insert: StoredIntegers, select: StoredIntegers, update: StoredIntegers, json: Integers }),
}) {}
```

The decoded value is an integer array in every variant. The database variants encode a native typed `int4[]` parameter; JSON retains the ordinary array. The same storage codec on `select` lets equality filters encode empty arrays too. `PgTypes.array` resolves the built-in `int4` array OID; `getOrThrow` unwraps that known constructor result. PostgreSQL still enforces its integer range on writes.

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

`insert` returns an `InvoiceLine` with the generated ID and decoded amount. The update supplies the model's required fields, the by-ID read reaches the saved row, and the final query returns an empty list after deletion. Repository CRUD uses native model variants and SQL schemas; `findMany` adds model-derived queries.

When an unversioned row may be absent, opt into a typed missing-row failure:

```ts
yield* lines.update(input, { onMissing: "fail" });
```

This returns the decoded model or fails with `NoSuchElementError` in the error channel, just like `findById`. It supports single-column and composite keys and executes one `UPDATE … RETURNING` statement without checking existence first. A successful update announces changes after commit; a missing row announces nothing. Without the option, a missing row remains a defect. Versioned repositories use their existing `OptimisticConcurrencyError` contract instead.

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

Filter entries are joined with `AND`. A field value uses equality; a null filter matches SQL `NULL`, and an omitted or `undefined` value leaves the field unconstrained. Filters use decoded field values, so `amount` takes a number. Selected results are decoded records with the selected fields' types; this function returns `Array<{ readonly name: string; readonly amount: number }>`.

Use `{ in: values }` to match any value in a list, alongside equality entries:

```ts
yield* lines.findMany({ where: { id: { in: [1, 3, 5] }, amount: 52 } });
```

Each list value uses the field's codec and decoded type. An empty list matches no rows. A plain array remains an equality value for an array-typed field; only the explicit `{ in: [...] }` entry requests SQL `IN`.

Use `count` with the same `where` shape as `findMany` to return the matching row count decoded as a number:

```ts
yield* lines.count({ where: { amount: { in: [20, 52] }, note: null } });
yield* lines.count();
```

Omitting `where` counts every row. An empty table returns `0`.

Use `tupleIn` to match several fields together against a list of tuples:

```ts
import { tupleIn } from "@shivaedev/sql/tupleIn.ts";

yield* lines.findMany({
  where: {
    ...tupleIn(InvoiceLine, ["name", "amount"], [["Consulting", 52], ["Travel", 20]]),
    note: null,
  },
  select: ["name", "amount"],
});
```

Each tuple matches all its fields together, so this filter does not match `("Consulting", 20)`. The field list has at least two model fields, and each tuple's length and decoded types follow that list. Every value passes through its field codec. Spread the filter beside other entries to combine them with `AND`, or pass it directly as `where`. The same filter works in `select` and unversioned `delete`. An empty tuple list matches nothing, including deleting no rows. Large lists keep every value in a bound parameter.

Use `gt`, `gte`, `lt` and `lte` for exclusive or inclusive bounds, and `like` for a text pattern:

```ts
yield* lines.findMany({
  where: { id: { gte: 2, lt: 10 }, name: { like: "Consult%" } },
  select: ["id", "name"],
  orderBy: { field: "id", direction: "asc" },
});
```

Bounds use decoded strings, numbers, bigints, `BigDecimal`, `Date` or `DateTime.Utc` values and run through the field codec. For a `timestamptz` field modeled with `Schema.Date`, use `{ gte: new Date("2026-10-25T00:00:00Z"), lt: new Date("2026-10-26T00:00:00Z") }` to read a UTC day. Multiple operators on a field are joined with `AND`. `like` takes text, with PostgreSQL's case-sensitive `%` and `_` wildcards; patterns are bound parameters. Invalid operand types fail with `SchemaError`. Both `findMany` and `select` accept these filters; repositories query one table.

`select` is a nonempty tuple of model field names. Leave it out to select all model fields. `orderBy` takes one `{ field, direction }` object or a nonempty list of them, applied in list order, with `asc` or `desc` for each direction; `limit` takes a nonnegative integer, and zero returns an empty list. Unknown selected or sorted field names passed at runtime fail with `SchemaError`, as do unknown filter keys with a defined value. Filter entries with `undefined` values are omitted before field validation. Use `aggregate` for grouped summaries, and [native SQL with composed schemas](https://github.com/ShivaeDev/platform/blob/main/docs/framework/cross-table-reads.md) for joins, percentiles, `having` or other queries outside these shapes.

If a field codec requires a service, provide it for the query. Filter encoding and selected-row decoding retain their required services in the Effect environment.

### Newest rows per group, distinct-on and grouped aggregates

Use `latestPerGroup` when each parent needs its own row limit, such as the newest 21 runs per repository, workflow and merge-queue flag on a dashboard:

```ts
const recentRuns = yield* runs.latestPerGroup({
  partitionBy: ["repositoryId", "workflow", "mergeQueue"],
  orderBy: [
    { field: "createdAt", direction: "desc" },
    { field: "id", direction: "desc" },
  ],
  limit: 21,
  where: { repositoryId: { in: repositoryIds }, status: "completed" },
});
```

Here `runs` is a repository whose model declares those fields. `partitionBy` and `orderBy` are nonempty lists of model fields, and ordering reuses the same `{ field, direction }` entries as `findMany`. End the ordering with a unique tie-break column (or columns for a composite key) to make membership and order stable when timestamps tie. The repository does not infer a tie-break. `limit` is a nonnegative integer per partition; zero returns no rows, and smaller groups return all their matching rows.

On PostgreSQL, pin every `partitionBy` field in `where` with equality, `null`, an `in` list, or a `tupleIn` over exactly the partition fields to read each group through a `cross join lateral` subquery with its own ordering and limit. Index the partition columns followed by the order columns, with the declared order directions, so each group’s index walk stops after `limit` matching rows. For the example above, pin `workflow` and `mergeQueue` as well as `repositoryId` to use this path. Null pins match null columns, and an empty pinned `in` list returns no rows without querying the database.

Otherwise, the typed `where` filter runs before `row_number() over (partition by ... order by ...)` ranks matching rows, and the outer query keeps ranks up to `limit`. Both paths encode filter values through their field schemas, decode all model fields without exposing internal columns, and read all matching groups in one statement. Results are ordered by partition columns ascending, then by the declared ordering within each partition.

Choose `latestPerGroup` for up to N complete rows per group. PostgreSQL `DISTINCT ON` is useful when you need exactly one representative row per nonempty group; `latestPerGroup` with `limit: 1` covers that case too. Use `aggregate` for grouped summaries such as time per file, ordered to show the slowest N groups:

```ts
const slowestFiles = yield* results.aggregate({
  groupBy: ["file"],
  aggregates: {
    total: { sum: "durationMs" },
    tests: { count: "*" },
    failed: { boolOr: "failed" },
  },
  orderBy: [{ field: "total", direction: "desc" }],
  limit: 10,
});
```

`groupBy` is a nonempty list of model fields. Each aggregate result name must differ from the group fields. `count: "*"` counts rows; `count: field` counts non-null values. `sum` and `avg` accept number or `BigDecimal` fields, `min` and `max` accept the same ordered fields as range filters, and `boolOr` and `boolAnd` accept boolean fields. Counts decode as numbers; sums and averages decode from text as the field's numeric type, min and max use the field schema, and boolean aggregates decode as booleans. Every aggregate except count is nullable for all-null groups. Group columns use their model schemas, and invalid results fail with `SchemaError`.

An optional `where` uses the `findMany` filters before grouping. `orderBy` is a list of group fields or aggregate result names, and `limit` is a nonnegative integer over the resulting groups. Unknown group, aggregate operand, filter or sort fields passed at runtime fail with `SchemaError` before SQL executes. Use native SQL for percentiles, `having`, joins and other queries outside this shape.

### Copy query results into another table

To copy a query directly into another table, prepare a select and map each target insert field to a projected source field:

```ts
const copied = yield* archive.insertFromSelect(
  lines.select({
    where: { amount: 52 },
    select: ["name", "amount", "note"],
    orderBy: { field: "name", direction: "asc" },
    limit: 20,
  }),
  { name: "name", amount: "amount", note: "note" },
);
```

Here `archive` is another unversioned `InvoiceLine` repository with its own table. `select` takes the same query options as `findMany` and prepares an Effect SQL fragment without reading rows into the application. `insertFromSelect(source, columns)` executes one `INSERT ... SELECT ... RETURNING` statement and returns Schema-decoded target model instances, including generated fields. The mapping requires all required target insert fields, allows optional insert fields, and checks source projection names plus decoded and encoded field types. Values move within SQL, so source decoding and target input encoding do not run; compatible schemas must describe compatible database storage.

A repository configured with `conflictColumns` also exposes `insertFromSelectOrIgnore(source, columns)`. It uses the same conflict columns and optional `conflictWhere` predicate as `insertOrIgnore`, skips existing keys, and returns only inserted rows. An empty source returns `[]`. Both writes join `transact` and roll back with it. Source filter encoding services and target result decoding services remain in the write's Effect environment.


### Composite keys and idempotent writes

A generated app can ingest the same reading more than once. Declare the table's primary key with an `idColumn` tuple and its unique conflict key with `conflictColumns`:

```ts
class Reading extends Model.Class<Reading>("Reading")({
  source: Schema.String,
  sequence: Schema.NumberFromString,
  amount: Schema.NumberFromString,
  label: Schema.String,
}) {}

const ingest = Effect.gen(function* () {
  const readings = yield* makeRepository(Reading, {
    tableName: "readings",
    idColumn: ["source", "sequence"],
    conflictColumns: ["source", "sequence"],
    spanPrefix: "Reading",
  });
  const input = { source: "meter", sequence: 1, amount: 52, label: "Imported" };
  const inserted = yield* readings.insertOrIgnore(input);
  const saved = yield* readings.upsert(
    { ...input, amount: 60 },
    { updateColumns: ["amount"] },
  );
  const found = yield* readings.findById({ source: "meter", sequence: 1 });
  return { inserted, saved, found };
});
```

The application creates `readings` with `PRIMARY KEY (source, sequence)`; `sequence` and `amount` are text columns for these codecs. Composite keys contain at least two model fields. `findById` and `delete` take an object containing every key field and encode each through its field schema. `update` and `updateVoid` use the full key from the model's update input and leave the key columns unchanged. Missing key fields fail with `SchemaError` before SQL runs. A scalar `idColumn` keeps native CRUD signatures. Writes announce a composite row as the table name, a colon and a JSON array of the returned key values in `idColumn` order, such as `readings:["meter","1"]`; a PostgreSQL `bigint` key value appears as its decimal string.

`conflictColumns` is a nonempty tuple of inserted model fields backed by a database unique constraint or primary key. It can differ from the primary key, including a unique external key beside a generated ID. Declaring it adds these methods:

| Method | Input | Result |
| --- | --- | --- |
| `insertOrIgnore` | Model insert input | `Option.some` of the decoded inserted model, or `Option.none` when the declared key conflicts. |
| `upsert` | Model insert input and `{ updateColumns: [...] }` | The decoded inserted or updated model. |
| `insertManyOrIgnore` | Readonly array of model insert inputs | Decoded inserted models; conflicting rows are omitted. |
| `upsertMany` | Readonly array of model insert inputs and `{ updateColumns: [...] }` | Decoded inserted or updated models. |

All four methods encode with the model's insert schema and retain its codec services. `upsert` and `upsertMany` require a nonempty list of inserted, updateable fields; primary-key, conflict-key and generated fields are excluded. Only those columns take their incoming encoded values on conflict. Other stored values stay intact. A selected optional field must be present in every encoded input. Unknown, empty, protected or absent update columns fail with `SchemaError`. A violation of another unique constraint remains a native `SqlError`.

For a partial unique index such as `CREATE UNIQUE INDEX ON entries (a, b) WHERE kind = 'x'`, add `conflictWhere` beside `conflictColumns`:

```ts
const entries = yield* makeRepository(Entry, {
  tableName: "entries",
  idColumn: "id",
  conflictColumns: ["a", "b"],
  conflictWhere: { kind: "x" },
  spanPrefix: "Entry",
});
const inserted = yield* entries.insertManyOrIgnore(inputs);
```

All four conflict methods use this target, producing `ON CONFLICT (a, b) WHERE kind = $n` before `DO NOTHING` or `DO UPDATE SET ...`, followed by `RETURNING`. `conflictWhere` uses typed equality entries like `findMany.where`: decoded field values pass through their field codecs and remain bound parameters. Rows outside the index predicate can insert with the same key. A target that matches no unique index fails with native `SqlError` in the error channel. Use native `SqlClient` and `SqlSchema` for SQL expressions or other conflict policies.

On PostgreSQL, pass `updateWhere` to conditionally apply the update branch:

```ts
const result = yield* pullRequests.upsert(incoming, {
  updateColumns: ["title", "updated_at"],
  updateWhere: { updated_at: { lt: { excluded: "updated_at" } } },
});
```

`updateWhere` uses the repository filter shape: equality, `in`, ranges and text patterns combine with AND. A field names the stored column; `{ excluded: "field" }` refers to an incoming column of the same decoded type, in equality or range operands. Literal values pass through their field codecs. The condition becomes `DO UPDATE SET ... WHERE ...`, separate from the index predicate `conflictWhere`, and does not restrict inserts. PostgreSQL evaluates it while holding the conflicting row lock, so an older or equal incoming timestamp cannot overwrite a newer stored revision.

With `updateWhere`, the typed result is `{ _tag: "Inserted", row }`, `{ _tag: "Updated", row }` or `{ _tag: "Unchanged" }`. Changed rows are decoded models; unchanged results carry no row and announce no change keys. Omitting `updateWhere` keeps the model result. `UpsertFilter` and `UpsertResult` are exported from `@shivaedev/sql/conditionalUpsert.ts`.

`upsertMany(inputs, { updateColumns, updateWhere })` accepts the same condition and returns one tagged result per input, in input order. It executes one statement per input inside one transaction, so a later failure rolls back earlier writes. This uses more database round trips than an unconditional batch. Other batch calls use the chunked statements described below.

Versioned repositories with `conflictColumns` offer `insertOrIgnore`, including optional `conflictWhere`; other conflict writes remain unavailable because they would overwrite rows without comparing versions. `versionColumn` accepts a scalar or composite `idColumn`.

### Batch writes

Every unversioned repository also offers `insertMany(inputs)`, without requiring `conflictColumns`. Each batch method accepts a readonly array of decoded model insert inputs. Unconditional batch methods return an array of decoded models; conditional upserts return the tagged outcomes described above. Empty inputs return `[]` without writing.

```ts
const saved = yield* readings.upsertMany(
  [
    { source: "meter", sequence: 1, amount: 60, label: "Imported" },
    { source: "meter", sequence: 2, amount: 75, label: "Imported" },
  ],
  { updateColumns: ["amount"] },
);
```

Unconditional batch writes use one `INSERT ... RETURNING` statement per chunk, with at most 1,000 rows and 10,000 bind parameters per statement, below PostgreSQL's 65,535 parameter limit. Missing optional fields use SQL `DEFAULT`; an explicit null stays null. Return values contain the rows returned by the database, with ignored conflicts omitted. PostgreSQL's native conflict rules apply within each chunk, including an error when an upsert tries to update the same stored row twice.

Each batch call starts `transact`, so a later chunk failure rolls back earlier chunks. A surrounding `transact` groups several calls into one commit and one deduplicated change batch.

### Optimistic concurrency

Declare a numeric version field in the model's select and update variants, leave it out of insert, and select it with `versionColumn`:

```ts
class Document extends Model.Class<Document>("Document")({
  id: Schema.String,
  ownerId: Schema.String,
  name: Schema.String,
  lockVersion: Model.Field({ select: Schema.Number, update: Schema.Number, json: Schema.Number }),
}) {}

const makeDocuments = makeRepository(Document, {
  tableName: "documents",
  idColumn: ["id", "ownerId"],
  conflictColumns: ["id"],
  spanPrefix: "Document",
  versionColumn: "lockVersion",
});

const reviseDocument = Effect.gen(function* () {
  const documents = yield* makeDocuments;
  const key = { id: crypto.randomUUID(), ownerId: "current-owner" };
  yield* documents.insertOrIgnore({ ...key, name: "Draft" });
  const original = yield* documents.findById(key);
  const saved = yield* documents.update({ ...original, name: "Published" });
  yield* documents.delete(key, saved.lockVersion);
});
```

The application creates the integer version column; no database default is required. `insert`, `insertVoid` and `insertOrIgnore` initialize it to `0`. The version field must encode and decode numbers without codec services, be required in updates, and differ from every primary key column. The example uses a unique `id` constraint so a retried creation returns `Option.none()` without reading or changing the existing row.

`update` and `updateVoid` treat the input's version as the version the caller read. Their single SQL statement matches every key column and the expected version and increments the stored version by one. With the composite key above, every write includes the owner. `update` returns the decoded model with the new version. `delete(key, expectedVersion)` matches every key column and the expected version before removing the row; it requires the expected version for a versioned repository.

A stale version or missing row fails with `OptimisticConcurrencyError` in the error channel for `update`, `updateVoid` and `delete`. Import it from `@shivaedev/sql/repository.ts`; its fields are `tableName`, `id`, `expectedVersion` and `reason: "missing" | "stale"`. For a composite key, `id` holds the full key object. Only a zero-row write triggers a read under that same full key to classify the failure: an absent key is `missing`, an existing key is `stale`. A row under another owner is `missing`, with no stored version or row data exposed. Two concurrent writers using the same read version produce one successful update and one conflict, and the losing write leaves the winner's data intact.

These writes use SQL `RETURNING`. Repositories without `versionColumn` retain native CRUD signatures and behavior.

### Transactions and invalidation

```ts
import { Data } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";

class StorageUnavailable extends Data.TaggedError("StorageUnavailable")<{
  readonly reason: string;
}> {}

const saveInvoiceLine = (input: typeof InvoiceLine.update.Type) =>
  Effect.gen(function* () {
    const lines = yield* makeInvoiceLines;
    const saved = yield* lines.update(input);
    return saved;
  }).pipe(
    transact({
      onSqlError: (error) => new StorageUnavailable({ reason: error.message }),
    }),
  );
```

`transact` wraps native `sql.withTransaction`. It maps typed `SqlError` failures through `onSqlError` and keeps other typed failures and service requirements. `invalidateOnCommit` records derived reader keys that a repository or command declaration does not already name; after the owning outermost commit, they are deduplicated and passed to native `Reactivity.invalidate` once. The record `{ invoiceLines: [1] }` marks `"invoiceLines"` and `"invoiceLines:1"`. An array such as `["invoiceLines:1"]` marks only those keys.

Repository writes returning more than 1,000 rows announce the table key and `<table>:*` instead of per-row item keys, counted across all chunks of each call. Calls returning up to 1,000 rows keep their table and item keys. Effect-contract item reads register the collection-wide key automatically; code registering raw `<table>:<id>` Reactivity keys must also register `<table>:*`. Command invalidation keys are unchanged.

The transaction rules follow the database owner:

- A typed failure or interruption before commit rolls back and announces nothing. A failed deferred `COMMIT` fails through `onSqlError` and also announces nothing.
- A nested `transact` on the same client uses a native savepoint. Its successful keys join the outer set; a rolled-back savepoint's keys are discarded.
- A transaction on a second client commits independently. Its keys publish when that client commits, even if the enclosing client's transaction later rolls back.
- Keys belong to the `SqlClient` in the recording Effect's context. Entering another client's transaction does not move an existing client's keys. Re-entering a still-open transaction on the original client joins its own savepoint.
- Recording from a fiber after its transaction finishes dies. Record every changed key before the body returns.

Begin the outermost changed transaction with `transact`. Both `transact` and `invalidateOnCommit` refuse a native outer `sql.withTransaction` they do not own, because they cannot observe its commit. Outside a transaction, `invalidateOnCommit` publishes immediately.

PostgreSQL commit visibility decides publication even when a caller is interrupted while `COMMIT` is in flight: if the database commits, keys publish and the caller remains interrupted. If invalidation itself fails after commit, the failure is logged and the committed result stands. Do not treat a notification failure as evidence that the write can be retried safely.

For the generic ownership mechanism, read [commit-bound changes](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md). Reactivity keys are local reader invalidation; an application's cross-process or browser delivery belongs at its delivery boundary.

### PostgreSQL advisory locks

Serialize cooperating jobs inside `transact`:

```ts
import { advisoryXactLock } from "@shivaedev/sql/advisoryXactLock.ts";

const serializeInvoiceJob = (input: typeof InvoiceLine.update.Type) => Effect.gen(function* () {
  yield* advisoryXactLock("jobs:invoice-import");
  yield* saveInvoiceLine(input);
}).pipe(
  transact({
    onSqlError: (error) => new StorageUnavailable({ reason: error.message }),
  }),
);
```

`advisoryXactLock(key: bigint | string)` waits for PostgreSQL's `pg_advisory_xact_lock` on the current client's transaction. A bigint is passed as a signed 64-bit PostgreSQL key without converting it to a JavaScript number. A string uses PostgreSQL's `hashtextextended(key, 0)` as its bigint key; use the same string in cooperating callers. Hash collisions share a lock. Different keys proceed independently. The lock lasts until commit or rollback, including rollback when the holding fiber is interrupted. Outside a transaction, the function fails with typed `AdvisoryLockOutsideTransaction` from the same module. SQL failures remain typed `SqlError` and follow the surrounding `transact` mapper.

### PostgreSQL migrations: one discovered folder

Application migrations live in `src/server/migrations/`. Name each file with a four-digit zero-padded sequential number, an underscore and a snake_case name, such as `0007_add_note_tags.ts`. Export the migration's SQL Effect as the default export:

```ts
import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`create table orders (name text primary key)`;
});
```

Run the discovered files from the application root:

```ts
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { migrationsFromDirectory } from "@shivaedev/sql/migrationsFromDirectory.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";

const migrateOrders = migratePostgres({
  table: "app_migrations",
  lockTimeout: "5 seconds",
  loader: migrationsFromDirectory(process.cwd()).pipe(Effect.provide(NodeServices.layer)),
});
```

`migrationsFromDirectory(root)` delegates discovery to Effect's `Migrator.fromFileSystem` and requires native `FileSystem` and `Path` services. Keep the folder beside the server source when deploying it, or include it in your server build. Adding a migration means adding one file; there is no import list. The first run of `0001_create_orders.ts` returns `[[1, "create_orders"]]`; repeating it returns `[]`, and adding a higher numbered file applies the new work. Treat applied migrations as immutable.

Use sequential numbers, not timestamps. Effect's Migrator skips any migration whose ID is not greater than the latest applied ID. A timestamped migration from a branch that merges late could therefore be silently skipped by native Migrator on an already-migrated database. Two branches that choose the same sequential number instead fail loudly with Effect's duplicate-ID `MigrationError` (`kind: "Duplicates"`), forcing the second branch to renumber and re-check. This package also rejects gaps below the latest applied ID, as described below.

`migrationConvention.ts` exports `MIGRATIONS_DIRECTORY` and `MIGRATION_FILE_PATTERN` so template packaging and repository quality configuration share the folder and filename convention.

`migratePostgres` rejects loaded migration IDs at or below the latest applied ID that are missing from the ledger with a typed native `MigrationError` (`kind: "BadState"`) naming those IDs.

`migratePostgres` takes a transaction-scoped advisory lock before creating the ledger and running native Migrator. Concurrent runners on a fresh or existing ledger wait, then see the committed ledger and avoid repeating the migrations. Every runner of that ledger must use this helper and the same ledger name. The required `lockTimeout` bounds PostgreSQL lock waits; `Duration.infinity` sets the transaction's lock timeout to zero. Choose deployment and execution timeouts in the application.

A failed batch rolls back its DDL, data and ledger entries, retaining previously committed migrations. A failed first batch also rolls back the bootstrapped ledger. A lock timeout fails with typed `SqlError` and reason `LockTimeoutError`; a migration-body SQL failure is a native `MigrationError` defect. Inspect startup completion with `Effect.exit` when both typed failures and defects matter. Keep nontransactional DDL in schema components; external side effects, crash recovery and deployment compatibility need their own migration policy.

Schema components describe storage owned by another engine alongside the numbered `loader`: pass `components: [{ name, apply, pending }]` to `migratePostgres` and `assertPostgresMigrations`. `apply` runs after the ledger transaction commits, outside that transaction, on every migration invocation; it must support repeated execution. `pending` returns a description when work remains and `undefined` when current. Components are never recorded as numbered ledger entries. Component failures become `MigrationError` (`kind: "Failed"`) with the component name and original cause; their failure leaves the application ledger committed.

For processes whose deployment owns migration execution, call `assertPostgresMigrations({ loader, table?, components? })` from `@shivaedev/sql/assertPostgresMigrations.ts` before starting services. It checks the native loader’s required IDs and names against the ledger without running migration bodies or creating a ledger. A missing ledger, pending migration or mismatched name fails with native `MigrationError` (`kind: "BadState"`); database failures stay typed `SqlError`. Later ledger entries are allowed so an older application version can start during a rolling deployment. Pending ledger IDs and component names and details appear together in the error. This checks recorded migrations and component readouts, not physical schema drift.

For a structured readiness readout, use `pendingPostgresMigrations({ loader, table?, components? })` from `@shivaedev/sql/pendingPostgresMigrations.ts`. It returns `{ migrations: [{ id, name }], components: [{ name, detail }] }` for pending work, with both arrays empty when current. It reads the same ledger and component checks as `assertPostgresMigrations` without running migrations.

Pass an optional `release` string to `migratePostgres` to record the owning release after all ledger migrations and schema components succeed. The final `postgresRelease(release, table?)` schema component owns a one-row `<ledger>_release` table with typed `release` and UTC `recorded_at timestamptz` columns, plus a `<ledger>_workers` table with typed process identity, release and UTC heartbeat columns. `readPostgresRelease(table?)` from `postgresRelease.ts` returns the recorded release and `recordedAt` Date, or `undefined` for a missing marker. `pendingPostgresMigrations({ loader, release, table? })` reports a missing or different release as a pending component. Without `release`, migration and readiness calls neither write nor read these tables.

Server's `appDatabase` supplies the optional `WorkerRelease` Context service in migration mode `"wait"` with a release. Startup waits for that marker within `waitTimeout`; subsequent checks run every `pollInterval`. Each worker database Layer claims a process row only when its release owns the marker and no live row of another release remains. Heartbeats continue every poll while jobs drain; completed drain and clean shutdown remove the row. Rows older than five polling intervals count as gone, bounding takeover after a crash (five seconds at the default one-second poll). Reserve SQL pool capacity for heartbeats alongside active jobs and the change listener. Release equality decides ownership, so rolling back the marker resumes the earlier worker. jobs reads the service automatically; applications do not connect a signal themselves. Web's `"check"` mode ignores the marker.


### PostgreSQL delivery between processes

`postgresChanges` from `@shivaedev/sql/postgresChanges.ts` returns a scoped Layer for the `transact` channel. Provide it to every process that writes, including job workers. Every server uses the same database and channel, its own native PostgreSQL client and its own Reactivity service. Create the server's `makeLiveServer` with that same Reactivity service and supply its `resync` Effect to the binding.

```ts
const delivery = postgresChanges({
  channel: "application_changes",
  client: pg,
  resync: hints.resync,
});
```

`pg` is the application's `@effect/sql-pg` client; the binding accepts its native SQL and `listen` methods without creating another pool. Reserve one session connection for LISTEN and another for writes and heartbeats; use a pool client with at least two connections. Compose `delivery` into the Layer that provides feature services using `transact`, alongside the existing SQL and Reactivity services. The [reference server](https://github.com/ShivaeDev/platform/blob/main/packages/react/src/test-support/postgres-example/server.ts) shows the complete composition. The binding sends `select pg_notify(...)` through the writing transaction's `SqlClient`, so a rollback wakes no process. Its transaction sink leaves delivery to the listener, including in the writing process. Unframed `invalidateOnCommit` calls retain local invalidation; cross-process writes must use `transact`.

`PostgresChangesOptions` takes `channel`, `client`, `resync`, and optional `heartbeatInterval`, `heartbeatTimeout` and `retryDelay` Effect durations. The defaults are 5 seconds, 10 seconds and 1 second. Acquisition waits for a heartbeat received through LISTEN. A missing heartbeat or a stream failure resyncs streams before listener cleanup; a successful reconnection resyncs again. Each listener finalizer has the same `heartbeatTimeout` deadline, so a stalled UNLISTEN cannot prevent the following native connection release or a fresh subscription. The heartbeat detects a listener that stops delivering without failing. `resync` is an infallible `Effect.Effect<number>` returning the number of open live streams it marked for reconciliation. `makeLiveServer.resync` provides this count and stops counting a stream when its scope closes. Direct bindings with another stream owner must return that owner's count. Provide the Layer for the process lifetime so scope release closes the listener.

NOTIFY is a wake-up signal, not a durable log. Transaction payloads contain only string or finite-number invalidation keys, with no row values. PostgreSQL requires each payload to be smaller than 8,000 bytes in the default configuration. The binding splits JSON arrays by their UTF-8 byte length; one key that cannot fit, or a nonserializable key type, fails with `SqlError` before commit and rolls back the write. Heartbeats use a separate control payload on the same channel. Applications choose a channel shared only by their cooperating processes. LISTEN requires a session connection; PgBouncer transaction pooling needs another delivery adapter. Missed notifications are reconciled by querying again on resync, with no replay guarantee.

### API

Import the module that defines the name; there is no root entry.

| Module | Export | Input or role |
| --- | --- | --- |
| `@shivaedev/sql/clientOptions.ts` | `clientOptions(options, { snakeCase? })`, `SqlNameTransforms` | Add default native name transforms to driver or app host options; opt out with `snakeCase: false`. |
| `@shivaedev/sql/repository.ts` | `makeRepository(model, options)` | `tableName`, scalar or composite `idColumn`, `spanPrefix`, optional `versionColumn`, `conflictColumns` and `conflictWhere`; requires native `SqlClient`. |
| `@shivaedev/sql/repository.ts` | `OptimisticConcurrencyError` | Typed stale or missing-row failure for versioned writes, with `tableName`, `id`, `expectedVersion`, `reason: "missing" | "stale"`. |
| `@shivaedev/sql/transact.ts` | `transact(effect, options)` or `effect.pipe(transact(options))` | Required `onSqlError` mapper; requires `SqlClient` and `Reactivity`. |
| `@shivaedev/sql/transact.ts` | `invalidateOnCommit(keys)` | Records keys for its client, or invalidates immediately outside a transaction. |
| `@shivaedev/sql/advisoryXactLock.ts` | `advisoryXactLock(key)`, `AdvisoryLockOutsideTransaction` | PostgreSQL transaction lock on a bigint or string hashed with `hashtextextended(key, 0)`; requires an active transaction on the current `SqlClient`. |
| `@shivaedev/sql/migrationConvention.ts` | `MIGRATIONS_DIRECTORY`, `MIGRATION_FILE_PATTERN` | Application folder and four-digit sequential snake_case TypeScript filename pattern. |
| `@shivaedev/sql/migrationsFromDirectory.ts` | `migrationsFromDirectory(root)` | Discover migrations under the application root with native `FileSystem` and `Path`. |
| `@shivaedev/sql/migrations.ts` | `migratePostgres(options)` | Native loader, required `lockTimeout`, optional `components` and ledger `table`, default `effect_sql_migrations`. |
| `@shivaedev/sql/assertPostgresMigrations.ts` | `assertPostgresMigrations({ loader, table?, components? })` | Read-only readiness check of required migration IDs and names in the native ledger and registered schema components. |
| `@shivaedev/sql/pendingPostgresMigrations.ts` | `pendingPostgresMigrations({ loader, table?, components? })` | Pending ledger migrations as ID and name, and pending schema components as name and detail. |
| `@shivaedev/sql/postgresChanges.ts` | `postgresChanges(options)` | Scoped PostgreSQL LISTEN/NOTIFY Layer for commit-bound invalidation. |

### Install and database setup

```sh
pnpm add @shivaedev/sql effect@4.0.5 @effect/sql-pg@4.0.5
```

`effect` is a peer. Install the native driver your application uses; this command chooses PostgreSQL. Provide its layer, and provide native Reactivity when using `transact` or `invalidateOnCommit`:

```ts
import * as PgClient from "@effect/sql-pg/PgClient";
import { Layer, Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";

const database = Layer.merge(
  PgClient.layer(clientOptions({ url: Redacted.make("postgresql://localhost/example") })),
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

Query decoding and invalid limits can fail with `SchemaError`; SQL statement failures remain `SqlError`. `findById` adds `NoSuchElementError` for a missing row. Unversioned `update` defects if it returns no row unless called with `{ onMissing: "fail" }`, which keeps `NoSuchElementError` in the error channel. Versioned updates and deletes instead fail with typed `OptimisticConcurrencyError` when their ID and expected version match no row. A failed `COMMIT` is a typed `SqlError` like any other statement failure.

Map a known constraint at the operation that understands it, after the transaction has rolled back:

```ts
import type { SqlError } from "effect/sql/SqlError";

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

For the native PostgreSQL driver's default representations, use precise numeric strings with `Schema.BigDecimalFromString`, `int8` values with `Schema.BigInt`, `date` values as `YYYY-MM-DD` strings with `Schema.String`, instants with `Schema.Date`, nullable text and generated values. A persisted value that violates its schema fails decoding; a write and read inside the enclosing transaction roll back together when that failure escapes.

JSON and JSONB columns are not supported. A repository write of a plain object to one fails with `SqlError` and writes nothing. Give structured data its own columns, or its own table when it repeats, so PostgreSQL constraints and the model both describe it.

`timestamptz` preserves an instant at millisecond precision; `timestamp without time zone` holds UTC wall time, whatever the Node process time zone. A model cannot recover microseconds the driver has discarded. See [PostgreSQL codec cases and limits](https://github.com/ShivaeDev/platform/blob/main/docs/framework/postgres-codecs.md) before choosing a storage representation.

The package's PostgreSQL tests use a disposable database through `PLATFORM_SQL_TEST_DATABASE_URL`. Without the URL they skip locally; under `CI`, collection fails at the shared gate.

The sql story kit exposes `withChangeCoverage` and `expectPublished`, also exported from `@shivaedev/sql/testing.ts`. `withChangeCoverage(body, { covers })` checks PostgreSQL transaction write counters before commit. Each written table must have its table key or at least one declared covering key recorded; otherwise `UnannouncedWrites` fails the transaction. Declare a module's domain read keys by table, including for raw SQL writes:

```ts
const coverage = { covers: { orders: ["dashboard:orders"] } };

yield* withChangeCoverage(
  Effect.gen(function* () {
    yield* sql`update orders set status = 'closed' where id = ${id}`;
    yield* invalidateOnCommit(["dashboard:orders"]);
  }),
  coverage,
).pipe(expectPublished(["dashboard:orders"]));
```

`body.pipe(expectPublished(keys))` compares the distinct published keys, regardless of order, and preserves the body's result. Put it outside the committing transaction. It observes the existing change channel and leaves delivery intact; recorded keys from rolled-back writes do not count. A mismatch fails with `PublishedKeysMismatch`, whose `expected`, `actual` and message show both key sets. The assertion happens after the body, so a mismatch does not roll back a committed write. See [automatic change delivery](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) for host defaults and coverage limits.
