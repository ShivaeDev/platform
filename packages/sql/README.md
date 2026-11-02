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

The application owns the database schema. For PostgreSQL, `postgresLayer` provides one native pool and the Effect SQL clients that use it. Configure new clients with `clientOptions` to map camelCase model fields to snake_case PostgreSQL columns. A **model** describes decoded row fields and the variants used for insertion, updating and JSON. A **repository** combines native `SqlModel` CRUD with a small `findMany` query whose filters and selected results use those fields.

Repository writes announce their table and returned row keys automatically. Every written row keeps its record key, including in bulk writes. Fields marked with `bucket` also announce their old and new bucket keys. Each write uses `transact`; start a surrounding multi-write boundary with `transact` too, so keys leave only after its owning database commits. Bare native transactions are refused because their commit cannot be observed. The change ownership comes from `changes`; this package supplies the SQL boundary and the Reactivity publisher.

Migrations are ordinary Effects loaded by native Migrator. `migratePostgres` adds coordination for PostgreSQL runners sharing a ledger. It does not derive a table from a model: migration SQL and row codecs must agree.

The work has three parts: describe the model and provide its database once, choose repository operations per feature, and put each changed write inside the transaction that owns its commit.

### Low-memory PostgreSQL hosts

`applyLowMemoryPostgres({ pointInTimeRecovery })` from `@shivaedev/sql/applyLowMemoryPostgres.ts` is an opt-in database-owner operation for small applications on Linux hosts that bill cgroup memory, including filesystem page cache. It uses the provided native `SqlClient` to write `ALTER SYSTEM` settings and request a reload. Run it once, outside a transaction, against the app's dedicated PostgreSQL instance with a role allowed to change these settings. It changes the whole instance, including every database on it. Keep it out of normal application startup and numbered migrations.

```ts
import { Config, Effect } from "effect";
import { applyLowMemoryPostgres } from "@shivaedev/sql/applyLowMemoryPostgres.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";

const configure = Effect.gen(function* () {
	const url = yield* Config.Redacted("DATABASE_URL");
	yield* applyLowMemoryPostgres({ pointInTimeRecovery: false }).pipe(Effect.provide(postgresLayer(url)));
}).pipe(Effect.scoped);
```

Restart PostgreSQL after this operation. `shared_buffers=32MB`, `max_connections=50` and `wal_buffers=4MB` take effect on restart. The reload settings are `jit=off`, `max_parallel_workers_per_gather=0`, `hash_mem_multiplier=1`, `autovacuum_max_workers=2`, `autovacuum_work_mem=32MB`, `idle_in_transaction_session_timeout=10min` and `wal_compression=zstd`. `idle_session_timeout=0` keeps idle LISTEN connections alive. Use PostgreSQL 18 with zstd support; older versions can require a restart for additional settings. Command-line `-c` settings override `ALTER SYSTEM`, so remove conflicting overrides. A failed operation can leave earlier settings written; correct the reported SQL error before restarting.

Point-in-time recovery is an explicit per-app memory and storage choice. With `pointInTimeRecovery: false`, the preset disables WAL archiving with `archive_mode=off`; it leaves `archive_timeout` alone and needs no backup bucket or pgBackRest configuration. Remove the host's archive and backup jobs and bucket configuration as well. This choice gives up recovery to a time between backups. With `true`, retain the host's working WAL archiving, backup bucket and restore procedure; the preset sets `archive_timeout=300` seconds. It does not provision backups or enable archiving. A timeout of 60 seconds can force a 16 MB WAL segment each minute even when the app is idle.

For PITR hosts, pgBackRest derives its process count from the CPU limit. Set a CPU limit of 2 or explicitly set `PGBACKREST_BACKUP_PROCESS_MAX=1` on the PostgreSQL service. Eight processes under a 32-vCPU limit exhausted a 477 MiB container in the reported Railway workload. Declare both CPU and memory limits in infrastructure as code: an omitted limit can be reset by the next plan. Keep enough headroom for backups, maintenance and the app's total connection budget across replicas and workers.

Pair this preset with server's [cache trim and connection lifetime](https://github.com/ShivaeDev/platform/tree/main/packages/server#low-memory-postgresql-hosts). Railway measurements supplied with this preset found billing within 0.2% of `memory.current`, shared memory around 45 MB instead of 175 MB, and small-app idle usage around 150–250 MB instead of 0.95 GB with preset, trim and connection recycling. Peaks returned within 5–10 minutes. These are workload observations, not memory limits or a promise for another app; measure your own cgroup before selecting a memory limit.

### One PostgreSQL pool per application

`postgresLayer(url, options)` from `@shivaedev/sql/postgresLayer.ts` provides the native `PgPool` service from `@effect/sql-pg/PgPool`, `PgClient` and `SqlClient` together. `options` accepts `applicationName`, `maxConnections`, `minConnections`, `connectionTTL`, `idleTimeout`, `transformQueryNames` and `transformResultNames`. Queries, transactions and raw connections reserved with `yield* pool.reserve` share the same `maxConnections` budget. A reservation holds its connection until its scope closes; release it before waiting for work that needs that slot.

```ts
import * as PgPool from "@effect/sql-pg/PgPool";
import { Effect, Redacted } from "effect";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";

const database = postgresLayer(Redacted.make("postgresql://localhost/example"), { maxConnections: 4 });
const backend = Effect.gen(function* () {
	const pool = yield* PgPool.PgPool;
	const connection = yield* pool.reserve;
	return yield* connection.query("select pg_backend_pid() as pid");
}).pipe(Effect.scoped, Effect.provide(database));
```

The Layer owns the pool and waits for every socket to close during shutdown. A reserved connection sees committed writes from client transactions in the same database; it does not implicitly join a client's open transaction. `appDatabase` from `@shivaedev/server/appDatabase.ts` and database-backed `appHost` from `@shivaedev/server/appHost.ts` compose this Layer and expose the pool to application services.

### SQL names: configure the client once

```ts
import * as PgClient from "@effect/sql-pg/PgClient";
import { Redacted } from "effect";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";

const database = PgClient.layer(
	clientOptions({
		url: Redacted.make("postgresql://localhost/example"),
	}),
);
```

`clientOptions` enables Effect SQL's `transformQueryNames` with Effect's `String.camelToSnake` and `transformResultNames` with `String.snakeToCamel` by default. A model field `createdAt` writes the migration-created `created_at` column, and returned rows contain `createdAt`. Inserts, selects, filters, ordering, updates and raw SQL share the client's transforms; column aliases are unnecessary. Write literal migration SQL with snake_case columns. In tagged SQL, interpolated identifiers such as `sql("createdAt")` are transformed; literal SQL text stays as written.

To opt out for an existing database with quoted camelCase columns or models with snake_case fields, use `PgClient.layer(clientOptions(options, { snakeCase: false }))`. Existing native clients are unchanged until configured with this helper. Native `transformQueryNames` and `transformResultNames` supplied in `options` take precedence. For `appHost` from `@shivaedev/server/appHost.ts` or `appDatabase` from `@shivaedev/server/appDatabase.ts`, use `clientOptions` on their `config` object; the host forwards those native transforms to its client.

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

The database supplies `id` on insert. Its `Model.Field` includes the ID in selected rows, updates and JSON, and leaves it out of insertion. Keep the repository's ID field in the update variant. An ordinary field such as `name` participates in the writable variants. By default, `update` takes the complete update shape; select particular columns when changing only part of a row.

`amount` uses a text column in this example. `Schema.NumberFromString` encodes a number for storage and decodes the driver's string on reads. The SQL schema still owns column types, constraints and defaults.

A generated creation time can have a different database and JSON representation:

```ts
const createdAt = Model.Field({
	select: Schema.Date,
	json: Schema.DateFromString,
});
```

This field is absent from insert and update. A PostgreSQL `timestamptz` default supplies a `Date` on the database boundary, while the JSON codec encodes a string. Choose each field's schema for the values its driver or transport actually returns.

For PostgreSQL `int8` and one-dimensional `int4[]` columns, wrap the field's value schema with a storage codec:

```ts
import { int8 } from "@shivaedev/sql/int8.ts";
import { int4Array } from "@shivaedev/sql/int4Array.ts";

const Integers = Schema.Array(Schema.Int);
const StoredIntegers = int4Array(Integers);

class Sample extends Model.Class<Sample>("Sample")({
	id: int8(Schema.BigInt),
	values: Model.Field({ insert: StoredIntegers, select: StoredIntegers, update: StoredIntegers, json: Integers }),
}) {}
```

`int8(field)` keeps bigint values exact beyond `Number.MAX_SAFE_INTEGER` and encodes native `PgTypes.int8` parameters. The native driver returns `bigint`; no conversion through a JS number occurs. `int4Array(field)` encodes a native array parameter with the `int4` element OID, including for an empty array. Both take the field schema, preserve its validation, and unwrap their native parameters when repository writes decode returned rows. PostgreSQL still enforces its integer ranges.

Use the array storage codec on select, insert and update so equality filters encode empty arrays too. Keep an ordinary array schema for JSON. A bigint field transported as JSON likewise needs an explicit transport codec in its JSON variant; these helpers describe database storage.

For a PostgreSQL `jsonb` column, wrap the value schema with `jsonb`:

```ts
import { jsonb } from "@shivaedev/sql/jsonb.ts";

const Details = Schema.Struct({
	amount: Schema.NumberFromString,
	routes: Schema.Array(Schema.Struct({ routeKey: Schema.String })),
});

class Receipt extends Model.Class<Receipt>("Receipt")({
	id: Schema.Int,
	details: Model.Field({
		select: jsonb(Details),
		insert: jsonb(Details),
		update: jsonb(Details),
		json: Details,
	}),
}) {}
```

`jsonb` uses native `PgTypes.jsonb` parameters. The supplied schema encodes nested values for storage and decodes PostgreSQL's returned object through the repository, including projections. Here `amount` is a number in application code and a string inside the stored JSON. Invalid input or stored data fails with `SchemaError`. Use `jsonb(Schema.NullOr(Details))` for a nullable column: a null input binds SQL `NULL`. The application still owns the column's DDL.

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

To change chosen columns without reading the row first, pass their names beside an input containing the primary key and those values:

```ts
yield* lines.update({ id: 1, amount: 55 }, { columns: ["amount"] });
yield* lines.updateVoid({ id: 1, note: null }, { columns: ["note"] });
yield* lines.update({ id: 2, name: "Travel" }, { columns: ["name"], onMissing: "fail" });
```

Each call executes one `UPDATE … RETURNING` without a preliminary read, encodes only the selected fields and every primary-key component through the model's update schemas, and publishes its table, record and old/new bucket keys after commit. Other columns retain their stored values, including omitted update timestamps. The column list is nonempty and contains writable fields other than the primary key; invalid selections fail with `SchemaError`. Composite-key inputs include every key component. `updateVoid` discards the returned row; `update` returns the decoded model and keeps the same missing-row behavior as a complete update. Column selection is available on unversioned repositories.

A selected row can be passed unchanged to `update` or `updateVoid`, including a model with native `Model.DateTimeUpdateFromDate`. Repository update inputs accept its ordinary read-back date-time value without requiring `Model.Override`; a supplied value is preserved.

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

Each list value uses the field's codec and decoded type. An empty list matches no rows. A plain array remains an equality value for an array-typed field.

A value accepted by the field's decoded schema uses equality through its codec before filter operators are considered. For a JSONB field whose schema accepts `{ gt: 7 }` or `{ in: [7] }`, those objects compare as JSON values. An object is an operator filter only when the field's decoded schema does not accept it. A nullable field's `null` equality matches SQL NULL, including on JSONB columns; it does not match JSON null. This rule applies to reads, counts and deletes.

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
    ...tupleIn(InvoiceLine, ["name", "amount"], [["Consulting", 52], ["Travel", 20]], { name: "text", amount: "text" }),
    note: null,
  },
  select: ["name", "amount"],
});
```

Each tuple matches all its fields together, so this filter does not match `("Consulting", 20)`. The field list has at least two model fields, and each tuple's length and decoded types follow that list. Every value passes through its field codec. Spread the filter beside other entries to combine them with `AND`, or pass it directly as `where`. The same filter works in `select` and unversioned `delete`. An empty tuple list matches nothing, including deleting no rows. On PostgreSQL, the fourth argument names each stored column’s scalar type using the names in `PgTypes.OID`, such as `text`, `int4` (integer), `int8` (bigint), `uuid`, `numeric` and `timestamptz`. Choose the database type, independently of the model’s decoded type: this example stores amounts as text. The helper binds one array per column, casts it to the declared type and matches through `unnest`; duplicate tuples do not duplicate results, and null tuple entries retain ordinary equality semantics. Array-valued and custom PostgreSQL columns use explicit native SQL.

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

### Native SQL list predicates

`inValues(column, values)` from `@shivaedev/sql/inValues.ts` returns an Effect requiring the native `SqlClient`. It builds a native SQL fragment: an empty list matches nothing, and a non-empty list binds each value as a parameter. Pass a column name or a native fragment for a qualified column. Keep request encoding, result decoding and the SQL itself in native `SqlSchema`:

```ts
import { SqlClient, SqlSchema } from "effect/sql";
import { inValues } from "@shivaedev/sql/inValues.ts";

const sql = yield* SqlClient.SqlClient;
const paymentsBySequence = SqlSchema.findAll({
	Request: Schema.Array(Payment.fields.sequence),
	Result: Schema.Struct({ sequence: Payment.fields.sequence }),
	execute: (sequences) => Effect.gen(function* () {
		const predicate = yield* inValues(sql`p.${sql("sequence")}`, sequences);
		return yield* sql`select p.sequence from payments p where ${predicate}`;
	}),
});

const rows = yield* paymentsBySequence([]);
```

`rows` is empty even when the table contains payments. The helper takes its column explicitly and leaves native `SqlSchema` visible. Use native SQL with composed schemas for joins; this helper adds no query layer or typed join.

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
	const saved = yield* readings.upsert({ ...input, amount: 60 }, { updateColumns: ["amount"] });
	const found = yield* readings.findById({ source: "meter", sequence: 1 });
	return { inserted, saved, found };
});
```

The application creates `readings` with `PRIMARY KEY (source, sequence)`; `sequence` and `amount` are text columns for these codecs. Composite keys contain at least two model fields. `findById` and `delete` take an object containing every key field and encode each through its field schema. `update` and `updateVoid` use the full key from the model's update input and leave the key columns unchanged. Missing key fields fail with `SchemaError` before SQL runs. A scalar `idColumn` keeps native CRUD signatures. Writes announce a composite row as the table name, a colon and a JSON array of the returned key values in `idColumn` order, such as `readings:["meter","1"]`; a PostgreSQL `bigint` key value appears as its decimal string. Build matching subscription ids with `compositeId` from `@shivaedev/changes/keys.ts`, using stored values in that same column order: `collection("readings", Schema.String).item(compositeId(["meter", "1"]))`. Manual invalidations use the same id: `invalidateOnCommit({ readings: [compositeId(["meter", "1"])] })`.

`conflictColumns` is a nonempty tuple of inserted model fields backed by a database unique constraint or primary key. It can differ from the primary key, including a unique external key beside a generated ID. Declaring it adds these methods:

| Method               | Input                                                                | Result                                                                                         |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `insertOrIgnore`     | Model insert input                                                   | `Option.some` of the decoded inserted model, or `Option.none` when the declared key conflicts. |
| `upsert`             | Model insert input and `{ updateColumns: [...] }`                    | `{ row, inserted }`, with the decoded model and a boolean identifying an insert.               |
| `insertManyOrIgnore` | Readonly array of model insert inputs                                | Decoded inserted models; conflicting rows are omitted.                                         |
| `upsertMany`         | Readonly array of model insert inputs and `{ updateColumns: [...] }` | An array of `{ row, inserted }` results.                                                       |

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

On PostgreSQL, `upsert` returns `{ row, inserted }`: `row` is the decoded model and `inserted` is `true` for an insert and `false` for an update. Read the model from `saved.row` or destructure `{ row }`. `upsertMany` returns the same shape for each returned row. `UpsertRow` is exported from `@shivaedev/sql/upsertResult.ts`.

With `updateWhere`, the typed result is `{ _tag: "Inserted", row, inserted: true }`, `{ _tag: "Updated", row, inserted: false }` or `{ _tag: "Unchanged" }`. Unchanged results carry no row and announce no change keys. `UpsertFilter` and `UpsertResult` are exported from `@shivaedev/sql/conditionalUpsert.ts`.

`upsertMany(inputs, { updateColumns, updateWhere })` accepts the same condition and returns one tagged result per input, in input order. It executes one statement per input inside one transaction, so a later failure rolls back earlier writes. This uses more database round trips than an unconditional batch. Other batch calls use the chunked statements described below.

Versioned repositories with `conflictColumns` offer `insertOrIgnore`, including optional `conflictWhere`; other conflict writes remain unavailable because they would overwrite rows without comparing versions. `versionColumn` accepts a scalar or composite `idColumn`.

### Batch writes

Every unversioned repository also offers `insertMany(inputs)`, without requiring `conflictColumns`. Each batch method accepts a readonly array of decoded model insert inputs. `insertMany` and `insertManyOrIgnore` return decoded models; `upsertMany` returns `{ row, inserted }` results, or the tagged outcomes described above when conditional. Empty inputs return `[]` without writing.

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

### Retention purges

On PostgreSQL, `deleteBatched({ where, batchSize, maxRows, pause })` removes matching rows in independently committed transactions and returns the number removed. `where` uses the same encoded filters as `findMany`, including comparisons. Each batch deletes at most `batchSize` rows; the last batch shrinks to respect `maxRows`. `batchSize` is a positive safe integer and `maxRows` is a nonnegative safe integer. A zero cap or no matching rows returns zero without announcing changes.

Each nonempty batch publishes one table-level change hint after commit, so queries watching the table refresh once per batch. It does not enumerate record or bucket keys. Use table subscriptions for data subject to retention purges. A later failure rolls back only its batch and its hint; earlier batches remain committed. SQL failures remain typed `SqlError` and invalid limits fail with `SchemaError`.

`pause` is an Effect duration between full batches while the cap permits more work. The method holds a PostgreSQL session advisory lock for the run; another purge of that table skips and returns zero, even when called through another repository instance. The lock is released on completion, failure or interruption. The run reserves one connection for the lock and uses another for batch transactions: allow at least two pool connections, plus capacity for other work. Use a direct PostgreSQL connection or session pooling, since transaction pooling cannot preserve session locks. Rows locked by other transactions are skipped and can be removed by a later run. Purges have no ordering guarantee.

Call it outside `transact` and native transactions so each batch can commit independently. Calling it inside either, or on another SQL driver, fails with `BatchedDeleteUnavailable` from `@shivaedev/sql/batchedDelete.ts`, whose `reason` is `"transaction"` or `"dialect"`.

An hourly job can bound retention work without keeping one large transaction open:

```ts
import { Clock, Effect } from "effect";
import { defineSchedule } from "@shivaedev/jobs/server/defineSchedule.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { AuditEntry } from "./models.ts";

export const PurgeAudit = defineSchedule({
	name: "purge-audit",
	cron: "0 * * * *",
}).run(
	Effect.gen(function* () {
		const audit = yield* makeRepository(AuditEntry, {
			idColumn: "id",
			tableName: "audit_entries",
			spanPrefix: "AuditEntry",
		});
		const now = yield* Clock.currentTimeMillis;
		const removed = yield* audit.deleteBatched({
			where: { createdAt: { lt: new Date(now - 30 * 24 * 60 * 60 * 1_000) } },
			batchSize: 1_000,
			maxRows: 50_000,
			pause: "100 millis",
		});
		yield* Effect.log({ removed });
	}),
);
```

Here the application's `AuditEntry` model has a `createdAt` field decoded as `Date`. Register `PurgeAudit` in the jobs Layer's `jobs` list and provide the database and change-feed Layers to the worker.

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
	const key = { id: `${yield* Random.nextInt}:${yield* Random.nextInt}`, ownerId: "current-owner" };
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

Mark bucket fields on the model with `bucket` from `@shivaedev/changes/buckets.ts`:

```ts
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";

class Note extends Model.Class<Note>("Note")({
	id: Schema.Number,
	listId: bucket(Schema.Number),
	owner: bucket(Schema.String),
	title: Schema.String,
}) {}

const notes = collection("notes", Note.fields.id, { listId: Note.fields.listId, owner: Note.fields.owner });
const makeNotes = makeRepository(Note, {
	collection: notes,
	idColumn: "id",
	spanPrefix: "Notes",
	tableName: "notes",
});
```

Pass the contract collection as the repository's `collection` option when the model has buckets. Registration fails with `BucketRegistrationError` if the collection is missing, its name differs from `tableName`, or its bucket field names differ from the model's annotated fields. The error names both declarations. Registration also rejects annotated fields whose decoded schemas cannot produce key values, naming them in `invalidFields`, before any write. Use explicit string or number schemas and refinements instead of opaque declarations; nullable and optional wrappers remain supported. Repositories without buckets may omit the collection. Every inserted, updated or deleted row announces its record key and each declared bucket from the old and new stored values. An insert belongs only to its new buckets; a move announces both sides; a delete announces the old buckets. Bucket codecs decode stored values before producing keys, so a `bucket(Schema.NumberFromString)` field matches a numeric query bucket even when stored as text. Nullable and optional bucket values contribute no key when absent. Bucket codecs must need no services and decode to strings, numbers or absent values.

Bucket writes require PostgreSQL 18 or later: native `RETURNING old` supplies old values atomically, including for conflict updates. Repositories without bucket fields keep their existing SQL dialect support. Bulk writes keep every record and bucket key; the PostgreSQL publisher splits large batches into NOTIFY payloads.

Record and bucket keys that must commit atomically with a write come from this model and repository path. A command's `invalidates(payload, result, viewer)` runs after its handler returns and uses a separate publication transaction. Failed publication retries twice with 50 ms and 100 ms backoffs. If those attempts fail, `postgresChanges` resynchronizes local live streams and broadcasts Resync on its change channel. If PostgreSQL also rejects the broadcast or cannot be reached, local streams still resynchronize, but healthy listeners on other hosts can miss the write until they reconnect or otherwise reconcile. The failure is logged; NOTIFY provides no durable replay.

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

const serializeInvoiceJob = (input: typeof InvoiceLine.update.Type) =>
	Effect.gen(function* () {
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

`migratePostgres` discovers migrations, then takes an advisory lock before creating the ledger and running native Migrator. Runs with only numbered migrations use a transaction lock and work with a one-connection pool. Runs with schema components or a `release` use a session lock that stays held through the ledger transaction, all schema components and release publication, and releases on completion, failure or interruption. Both lock modes coordinate on the same ledger key. Concurrent runners on a fresh or existing ledger wait, then see the committed ledger and avoid repeating migrations; their schema components never overlap. Every runner of that ledger must use this helper and the same ledger name. The session lock reserves one pool connection while migration and component SQL use other connections: allow at least two connections for an active runner with components or a release, plus room for waiting runners and other work. Those runs require a direct PostgreSQL connection or session pooling. The required `lockTimeout` bounds acquisition of the advisory lock and lock waits in the ledger transaction; `Duration.infinity` disables those lock timeouts. Choose deployment and execution timeouts in the application.

A failed batch rolls back its DDL, data and ledger entries, retaining previously committed migrations. A failed first batch also rolls back the bootstrapped ledger. A lock timeout fails with typed `SqlError` and reason `LockTimeoutError`; a migration-body SQL failure is a typed native `MigrationError`. Inspect startup completion with `Effect.exit` when both typed failures and defects matter. Keep nontransactional DDL in schema components; external side effects, crash recovery and deployment compatibility need their own migration policy.

Schema components describe storage owned by another engine alongside the numbered `loader`: pass `components: [{ name, apply, pending }]` to `migratePostgres` and `assertPostgresMigrations`. `apply` runs after the ledger transaction commits, outside that transaction, on every migration invocation; it must support repeated execution. `pending` returns a description when work remains and `undefined` when current. Components are never recorded as numbered ledger entries. Component failures reach callers unchanged, including their original tags and causes, and are logged with the component name; their failure leaves the application ledger committed. Migration and readiness functions infer component error types. An explicitly annotated `PostgresMigrationOptions<R, E>` uses its second parameter for those errors; omitting it describes components that cannot fail.

For processes whose deployment owns migration execution, call `assertPostgresMigrations({ loader, table?, components? })` from `@shivaedev/sql/assertPostgresMigrations.ts` before starting services. It checks the native loader’s required IDs and names against the ledger without running migration bodies or creating a ledger. A missing ledger, pending migration or mismatched name fails with native `MigrationError` (`kind: "BadState"`); database failures stay typed `SqlError`. Later ledger entries are allowed so an older application version can start during a rolling deployment. Pending ledger IDs and component names and details appear together in the error. This checks recorded migrations and component readouts, not physical schema drift.

For a structured readiness readout, use `pendingPostgresMigrations({ loader, table?, components? })` from `@shivaedev/sql/pendingPostgresMigrations.ts`. It returns `{ migrations: [{ id, name }], components: [{ name, detail }] }` for pending work, with both arrays empty when current. It reads the same ledger and component checks as `assertPostgresMigrations` without running migrations. Malformed ledger and release rows fail with `SchemaError`.

Pass an optional `release` string to `migratePostgres` to record the owning release after all ledger migrations and schema components succeed. A failed component publishes no release and preserves any existing marker. PostgreSQL timestamps each invocation before discovery and locking, and the marker accepts only a strictly newer timestamp, so an older invocation finishing later cannot replace a newer release. Release labels are opaque strings; they are not sorted. To deploy an earlier release again, start a new invocation. The final `postgresRelease(release, table?)` schema component owns a one-row `<ledger>_release` table with typed `release` and UTC `recorded_at timestamptz` columns, plus a `<ledger>_workers` table with typed process identity, release and UTC heartbeat columns. `readPostgresRelease(table?)` from `postgresRelease.ts` returns the recorded release and `recordedAt` Date of the invocation's start, or `undefined` for a missing marker. A standalone `postgresRelease` component timestamps the start of its `apply` effect. `pendingPostgresMigrations({ loader, release, table? })` reports a missing or different release as a pending component. Without `release`, migration and readiness calls neither write nor read these tables.

`appDatabase` from `@shivaedev/server/appDatabase.ts` supplies the optional `WorkerRelease` Context service in migration mode `"wait"` with a release. Startup waits for that marker within `waitTimeout`; subsequent checks run every `pollInterval`. Each worker database Layer claims a process row only when its release owns the marker and no live row of another release remains. Heartbeats continue every poll while jobs drain, including after a connection blip. Each failed heartbeat or ownership poll logs its cause and retries three times, one quarter of a polling interval apart; exhausted retries close the worker scope with the failure cause. Completed drain and clean shutdown remove the row. Rows older than five polling intervals count as gone, bounding takeover after a crash (five seconds at the default one-second poll). Reserve SQL pool capacity for heartbeats alongside active jobs and the change listener. Release equality decides ownership, so a new migration invocation publishing an earlier release resumes that release's worker. `@shivaedev/jobs` reads the service automatically; applications do not connect a signal themselves. Web's `"check"` mode ignores the marker.

### PostgreSQL delivery between processes

`postgresChanges` from `@shivaedev/sql/postgresChanges.ts` returns a scoped Layer for the `transact` channel. Provide it to every process that writes, including job workers. Every server uses the same database and channel, its own native PostgreSQL client and its own Reactivity service. Create the server's `makeLiveServer` with that same Reactivity service and supply its `resync` Effect to the binding.

```ts
const delivery = postgresChanges({
	channel: "application_changes",
	client: pg,
	resync: hints.resync,
});
```

`pg` is the application's `@effect/sql-pg` client; the binding accepts its native SQL and `listen` methods without creating another pool. Optional `listenerClient` supplies a different native client for LISTEN; the application client still owns write notifications and heartbeat publication. Both clients must reach the same database. LISTEN requires a direct or session-mode connection. With one shared client, reserve one session connection for LISTEN and another for writes and heartbeats; use a pool client with at least two connections. With separate clients, the listener needs one connection of its own. Compose `delivery` into the Layer that provides feature services using `transact`, alongside the existing SQL and Reactivity services. The [reference server](https://github.com/ShivaeDev/platform/blob/main/packages/react/src/test-support/postgres-example/server.ts) shows the complete composition. The binding sends `select pg_notify(...)` through the writing transaction's `SqlClient`, so a rollback wakes no process. Its transaction sink leaves delivery to the listener, including in the writing process. Unframed `invalidateOnCommit` calls retain local invalidation; cross-process writes must use `transact`.

`PostgresChangesOptions` takes `channel`, `client`, `resync`, optional `listenerClient` and `connectionSetting` (a diagnostic label, default `"client"`), and optional `heartbeatInterval`, `heartbeatTimeout` and `retryDelay` Effect durations. The defaults are 5 seconds, 10 seconds and 1 second. Acquisition waits for LISTEN and then a heartbeat received through it, each within `heartbeatTimeout`. A deadline without a heartbeat fails startup with `PostgresListenerError` from `@shivaedev/sql/PostgresListenerError.ts`, whose `connectionSetting` and message identify the connection to fix. Native SQL failures still fail startup with `SqlError`. Established listeners reconnect after a loss. Loss and reconnect failures log their causes. A missing heartbeat or a stream failure resyncs streams before listener cleanup; a successful reconnection resyncs again. Listener cleanup runs in a parallel sub-scope bounded by `heartbeatTimeout`, so stalled listener cleanup cannot delay native connection release, a fresh subscription or scope shutdown. The heartbeat detects a listener that stops delivering without failing. `resync` is an infallible `Effect.Effect<number>` returning the number of open live streams it marked for reconciliation. `makeLiveServer.resync` provides this count and stops counting a stream when its scope closes. Direct bindings with another stream owner must return that owner's count. Provide the Layer for the process lifetime so scope release closes the listener.

NOTIFY is a wake-up signal, not a durable log. Transaction payloads contain only string or finite-number invalidation keys, with no row values. PostgreSQL requires each payload to be smaller than 8,000 bytes in the default configuration. The binding splits JSON arrays by their UTF-8 byte length; one key that cannot fit, or a nonserializable key type, fails with `SqlError` before commit and rolls back the write. Heartbeats use a separate control payload on the same channel. Applications choose a channel shared only by their cooperating processes. LISTEN requires a session connection; PgBouncer transaction pooling needs another delivery adapter. Missed notifications are reconciled by querying again on resync, with no replay guarantee.

### API

Import the module that defines the name; there is no root entry.
- `@shivaedev/sql/clientOptions.ts`: `clientOptions(options, { snakeCase? })`, `SqlNameTransforms` — Add default native name transforms to driver or app host options; opt out with `snakeCase: false`.
- `@shivaedev/sql/inValues.ts`: `inValues(column, values)` — Native list predicate with match-nothing semantics for an empty list; requires `SqlClient`.
- `@shivaedev/sql/int8.ts`: `int8(field)` — PostgreSQL bigint storage codec using the supplied field schema.
- `@shivaedev/sql/int4Array.ts`: `int4Array(field)` — PostgreSQL integer-array storage codec, including typed empty arrays.
- `@shivaedev/sql/repository.ts`: `makeRepository(model, options)` — `tableName`, scalar or composite `idColumn`, `spanPrefix`, optional `versionColumn`, `conflictColumns` and `conflictWhere`, and `collection` required for bucket models; requires native `SqlClient`.
- `@shivaedev/sql/repository.ts`: `OptimisticConcurrencyError` — Typed stale or missing-row failure for versioned writes, with `tableName`, `id`, `expectedVersion`, `reason: "missing" | "stale"`.
- `@shivaedev/sql/tupleIn.ts`: `tupleIn(model, fields, tuples, types)` — Filter entry matching two or more fields together against a list of tuples, for `where` in reads and unversioned deletes.
- `@shivaedev/sql/upsertResult.ts`: `UpsertRow` — The `{ row, inserted }` result of an unconditional upsert.
- `@shivaedev/sql/conditionalUpsert.ts`: `UpsertFilter`, `UpsertResult` — The `updateWhere` filter shape and the tagged `Inserted`, `Updated` or `Unchanged` result of a conditional upsert.
- `@shivaedev/sql/mapSqlError.ts`: `mapSqlError({ constraints, fallback })` — Mapper from named constraint violations to application errors, with a fallback for every other `SqlError`.
- `@shivaedev/sql/transact.ts`: `transact(effect, options)` or `effect.pipe(transact(options))` — Required `onSqlError` mapper; requires `SqlClient` and `Reactivity`.
- `@shivaedev/sql/transact.ts`: `invalidateOnCommit(keys)` — Records keys for its client, or invalidates immediately outside a transaction.
- `@shivaedev/sql/advisoryXactLock.ts`: `advisoryXactLock(key)`, `AdvisoryLockOutsideTransaction` — PostgreSQL transaction lock on a bigint or string hashed with `hashtextextended(key, 0)`; requires an active transaction on the current `SqlClient`.
- `@shivaedev/sql/migrationConvention.ts`: `MIGRATIONS_DIRECTORY`, `MIGRATION_FILE_PATTERN` — Application folder and four-digit sequential snake_case TypeScript filename pattern.
- `@shivaedev/sql/migrationsFromDirectory.ts`: `migrationsFromDirectory(root)` — Discover migrations under the application root with native `FileSystem` and `Path`.
- `@shivaedev/sql/migrations.ts`: `migratePostgres(options)` — Native loader, required `lockTimeout`, optional `components`, `release` and ledger `table`, default `effect_sql_migrations`.
- `@shivaedev/sql/assertPostgresMigrations.ts`: `assertPostgresMigrations({ loader, table?, components? })` — Read-only readiness check of required migration IDs and names in the native ledger and registered schema components.
- `@shivaedev/sql/pendingPostgresMigrations.ts`: `pendingPostgresMigrations({ loader, table?, components? })` — Pending ledger migrations as ID and name, and pending schema components as name and detail.
- `@shivaedev/sql/postgresRelease.ts`: `postgresRelease(release, table?)`, `readPostgresRelease(table?)` — Release marker schema component and its reader.
- `@shivaedev/sql/postgresChanges.ts`: `postgresChanges(options)` — Scoped PostgreSQL LISTEN/NOTIFY Layer for commit-bound invalidation.
- `@shivaedev/sql/repositoryCollection.ts`: `BucketRegistrationError` — Registration failure with table, collection and bucket field names.
- `@shivaedev/sql/testing.ts`: `withChangeCoverage(body, { covers })`, `expectPublished(keys)`, `UnannouncedWrites`, `PublishedKeysMismatch` — Test assertions that every write announced its keys and that the expected keys were published.

### Install and database setup

```sh
pnpm add @shivaedev/sql effect @effect/sql-pg
```

`effect` is a peer. Install the native driver your application uses; this command chooses PostgreSQL. Provide its layer, and provide native Reactivity when using `transact` or `invalidateOnCommit`:

```ts
import * as PgClient from "@effect/sql-pg/PgClient";
import { Layer, Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";

const database = Layer.merge(PgClient.layer(clientOptions({ url: Redacted.make("postgresql://localhost/example") })), Reactivity.layer);

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

Map named constraints at the operation that understands them. `mapSqlError` returns a mapper for `transact`'s `onSqlError` or `Effect.mapError` on an Effect whose error is `SqlError`:

```ts
import { mapSqlError } from "@shivaedev/sql/mapSqlError.ts";
import { transact } from "@shivaedev/sql/transact.ts";

const onSqlError = mapSqlError({
	constraints: {
		"invoice_line_name_key": () => new NameTaken(),
		"invoice_line_invoice_fkey": () => new InvoiceMissing(),
		"invoice_line_amount_check": () => new InvalidAmount(),
	},
	fallback: (error) => new StorageUnavailable({ reason: error.message }),
});

const insertNamedLine = lines.insert({ amount: 52, name: "Consulting", note: null }).pipe(transact({ onSqlError }));
```

The mapper handles named unique violations and PostgreSQL foreign-key and check violations. Every other `SqlError`, including unknown constraints, goes to `fallback`. A constraint name longer than PostgreSQL's 63-byte identifier limit matches the clipped name PostgreSQL stores and reports. Each callback receives the original error. The inferred error type contains exactly the mapped errors and the fallback; `transact` also preserves other typed failures from the operation. Constraint names belong to the application's migration; error types and presentation belong to the application.

Recover outside `transact` so earlier writes roll back before handling a mapped domain error. A losing unique-key insert can then catch `NameTaken` and read the winner's row without a private transaction error. See the [constraint-failures guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/constraint-errors.md).

For the native PostgreSQL driver's default representations, use precise numeric strings with `Schema.BigDecimalFromString`, `int8` values with `int8(Schema.BigInt)`, `date` values as `YYYY-MM-DD` strings with `Schema.String`, instants with `Schema.Date`, nullable text and generated values. A persisted value that violates its schema fails decoding; a write and read inside the enclosing transaction roll back together when that failure escapes.

JSON and JSONB columns are not supported. A repository write of a plain object to one fails with `SqlError` and writes nothing. Give structured data its own columns, or its own table when it repeats, so PostgreSQL constraints and the model both describe it.

`timestamptz` preserves an instant at millisecond precision; `timestamp without time zone` holds UTC wall time, whatever the Node process time zone. A model cannot recover microseconds the driver has discarded. See [PostgreSQL codec cases and limits](https://github.com/ShivaeDev/platform/blob/main/docs/framework/postgres-codecs.md) before choosing a storage representation.

The package's PostgreSQL tests use a disposable database through `PLATFORM_SQL_TEST_DATABASE_URL`. Without the URL they skip locally; under `CI`, collection fails at the shared gate.

The sql story kit exposes `withChangeCoverage` and `expectPublished`, also exported from `@shivaedev/sql/testing.ts`. `withChangeCoverage(body, { covers })` checks PostgreSQL transaction write counters before commit and requires every declared record and bucket key to be recorded. Repository writes supply these declarations automatically. Raw writes must declare their affected keys through `covers` and record them through the same after-commit path; a table key alone covers nothing. Missing announcements fail with `UnannouncedWrites` and roll back the transaction.

```ts
const changed = [notes.item(id), notes.bucket.listId(oldList), notes.bucket.listId(newList), notes.bucket.owner(owner)];

yield* withChangeCoverage(
  Effect.gen(function* () {
    yield* sql`update notes set "listId" = ${newList} where id = ${id}`;
    yield* invalidateOnCommit(invalidationKeys(changed));
  }),
  { covers: { notes: changed } },
);
```

The coverage check verifies the declarations, not the contents of arbitrary SQL. Raw writers must declare every affected record and bucket, including unchanged buckets. Transaction statistics retain writes from rolled-back savepoints, so those writes still need declarations during a coverage check.

`body.pipe(expectPublished(keys))` accepts an array or a function of the successful body result and compares the distinct published keys, regardless of order, and preserves the body's result. Put it outside the committing transaction. It observes the existing change channel and leaves delivery intact; recorded keys from rolled-back writes do not count. A mismatch fails with `PublishedKeysMismatch`, whose `expected`, `actual` and message show both key sets. The assertion happens after the body, so a mismatch does not roll back a committed write. For generated ids, derive keys after the write:

```ts
const note = yield* repository.insert(draft).pipe(
	expectPublished((row: Note) => invalidationKeys([notes.item(row.id), notes.bucket.listId(row.listId), notes.bucket.owner(row.owner)])),
);
```

See [automatic change delivery](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) for host defaults and coverage limits.
