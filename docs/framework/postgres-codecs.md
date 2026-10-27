# PostgreSQL model codecs

The repository can preserve exact decimal and 64-bit integer values without
another model adapter. The important boundary is the value the driver actually
returns: Schema decodes that value, not PostgreSQL's abstract column type.

Values below use the native client of `@effect/sql-pg` with its default type handling; no custom type handling is installed.

| Database value | Model field | Behavior | Boundary |
| --- | --- | --- | --- |
| `numeric(36,12)` | `Schema.BigDecimalFromString` | Insert, selected read, equality filter, and update preserve `9007199254740993.123456789012` exactly. | PostgreSQL returns a string; converting it to JS `number` first loses precision. Database scale/precision still constrain writes. `numeric 'NaN'` is rejected by this schema. |
| `int8` | `Schema.BigInt` | Insert, selected read and update preserve `9007199254740993n`, beyond `Number.MAX_SAFE_INTEGER`. | The driver returns `bigint`; a `Schema.Number` field rejects it. |
| `int4[]` | Integer-array schema with native `PgTypes.array(values, PgTypes.OID.int4)` encoding | Empty and non-empty arrays round-trip through inserts, reads, equality filters, updates and batch writes. | Empty arrays require an explicit element OID. Use the storage codec for select, insert and update, and an ordinary array schema for JSON; see the [model declaration](../../packages/sql/README.md#1-once-per-model-fields-and-writable-variants) and [PostgreSQL evidence](../../packages/sql/src/postgresArrays.spec.ts). |
| `date` | `Schema.String` | Insert, read and update keep `2026-09-30` as a `YYYY-MM-DD` string. | The driver returns the calendar date, not a `Date`, so no time zone shifts it. |
| `timestamptz` | `Schema.Date` | Insert/read preserves the instant; a SQL value with `+02` offset reads as the equivalent UTC instant. | The driver produces a JS `Date`, retaining milliseconds, losing sub-millisecond precision and the originally supplied zone/offset. |
| `timestamp without time zone` | `Schema.Date` | A `Date` is written as its UTC wall time and read back as that UTC instant, even when the Node process runs in `America/New_York`. | The column holds UTC wall time. A value written by another client in local time reads as if it were UTC. |
| Nullable text | `Schema.NullOr(Schema.String)` | Null insert/read, `IS NULL` filtering, and update to a string. | Schema nullability and the SQL column constraint must agree; one does not create the other. |
| Generated integer ID | `Model.Field({ select, update, json })` | Database supplies identity on insert; repository uses returned ID for update/read. | ID is intentionally absent from the insert variant but present in update, as native repository typing requires. |
| Database-generated creation time | `Model.Field({ select: Schema.Date, json: Schema.DateFromString })` | Omitted from insert/update; `RETURNING` decodes the database default as a Date. | PostgreSQL owns the default; model variants describe it but do not generate DDL. |

## JSON columns are not supported

`sql` models rows as columns. A repository write of a plain object to a
`json` or `jsonb` column fails with a typed `SqlError` and writes no row. Give structured data its own columns, or its own table when it
repeats. JSON stored in a column hides its shape from PostgreSQL constraints,
indexes and migrations, and from the model that should describe it once.

## The model remains the source of application types

The model, not a second query schema, describes the row:

```ts
class Payment extends Model.Class<Payment>("Payment")({
  id: Model.Field({
    select: Schema.Number,
    update: Schema.Number,
    json: Schema.Number,
  }),
  amount: Schema.BigDecimalFromString,
  sequence: Schema.BigInt,
  "due_on": Schema.String,
  "settled_at": Schema.Date,
  note: Schema.NullOr(Schema.String),
  "created_at": Model.Field({
    select: Schema.Date,
    json: Schema.DateFromString,
  }),
}) {}

const payments = yield* makeRepository(Payment, {
  tableName: "payments",
  idColumn: "id",
  spanPrefix: "Payment",
})

const rows = yield* payments.findMany({
  where: { amount: BigDecimal.fromStringUnsafe("9007199254740993.123456789012") },
  select: ["amount", "sequence"],
})
// Inferred: Array<{ readonly amount: BigDecimal; readonly sequence: bigint }>
```

`fromStringUnsafe` above constructs a known constant. Decode untrusted decimal
input with Schema through the normal Effect error channel.

SQL storage codecs and transport codecs are separate variants of the same model.
A Date returned by PostgreSQL is not an ISO string returned by JSON transport.
The generated time field above makes that distinction explicit. A complete RPC
contract must similarly choose suitable JSON codecs for each transported field;
these tests cover the database boundary, not decimal, bigint or date RPC
serialization.

## Invalid persisted values fail before they reach application code

A valid SQL value that violates the model, such as numeric `NaN` for a `BigDecimal` field, fails the selected read with `SchemaError`. A decoder alone does not undo a write: put the write and the decoding read inside the transaction whose rollback you need, and do not catch the failure inside it.

## Deliberate limits

Use `timestamptz` for instants and accept millisecond precision only where the
application can tolerate it. PostgreSQL still stores `.345678` when JS has decoded only `.345`.

Applications needing exact microseconds or PostgreSQL infinity require an
explicit encoding policy before adoption. Changing a schema cannot recover precision already discarded by a driver.

Arrays other than one-dimensional `int4[]`, enums, ranges, binary data and custom type policies are untested.
