# PostgreSQL model codecs

The repository can preserve exact decimal values and validate PostgreSQL JSON
without another model adapter. The important boundary is the value the driver
actually returns: Schema decodes that value, not PostgreSQL's abstract column type.

[Executable PostgreSQL coverage](../../packages/effect-sql/src/postgresCodecs.spec.ts)
uses `@effect/sql-pg` / Effect `4.0.0-rc.112`, its resolved `pg` `8.23.0`, default
node-postgres type parsers, and PostgreSQL 18. No global parser overrides are
installed. Every test uses an independently named temporary table inside a
transaction, with `ON COMMIT DROP`.

| Database value | Model field | Proven behavior | Boundary |
| --- | --- | --- | --- |
| `numeric(36,12)` | `Schema.BigDecimalFromString` | Insert, selected read, equality filter, and update preserve `9007199254740993.123456789012` exactly. | PostgreSQL returns a string; converting it to JS `number` first loses precision. Database scale/precision still constrain writes. `numeric 'NaN'` is rejected by this schema. |
| `timestamptz` | `Schema.Date` | Insert/read preserves the instant; a SQL value with `+02` offset reads as the equivalent UTC instant. | Default parser produces JS `Date`, retaining milliseconds, losing sub-millisecond precision and the originally supplied zone/offset. |
| `timestamp without time zone` | `Schema.Date` | Insert/read preserves local components with the default node-postgres parser in the same process timezone. | This is a wall time interpreted using the Node process timezone, not a portable instant. Changing timezone changes its interpretation; DST disambiguation is not solved. |
| `json` / `jsonb` object | `Schema.Struct(...)` | Both insert/read as objects; `jsonb` also updates and works in a selected field. | The driver already parses JSON. Do not use `Model.JsonFromString` for these default object results; that helper targets JSON stored as text. |
| Nullable text | `Schema.NullOr(Schema.String)` | Null insert/read, `IS NULL` filtering, and update to a string. | Schema nullability and the SQL column constraint must agree; one does not create the other. |
| Generated integer ID | `Model.Field({ select, update, json })` | Database supplies identity on insert; repository uses returned ID for update/read. | ID is intentionally absent from the insert variant but present in update, as native repository typing requires. This does not prove bigint identity conversion. |
| Database-generated creation time | `Model.Field({ select: Schema.Date, json: Schema.DateFromString })` | Omitted from insert/update; `RETURNING` decodes the database default as a Date. | PostgreSQL owns the default; model variants describe it but do not generate DDL. |

## The model remains the source of application types

This is the relevant portion of the tested model, not a second query schema:

```ts
class Payment extends Model.Class<Payment>("Payment")({
  id: Model.Field({
    select: Schema.Number,
    update: Schema.Number,
    json: Schema.Number,
  }),
  amount: Schema.BigDecimalFromString,
  settled_at: Schema.Date,
  details: Schema.Struct({ channel: Schema.String, attempts: Schema.Int }),
  note: Schema.NullOr(Schema.String),
  created_at: Model.Field({
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
  select: ["amount", "details"],
})
// Inferred: Array<{ readonly amount: BigDecimal;
//   readonly details: { readonly channel: string; readonly attempts: number } }>
```

`fromStringUnsafe` above constructs a known constant. Decode untrusted decimal
input with Schema through the normal Effect error channel.

SQL storage codecs and transport codecs are separate variants of the same model.
A Date returned by PostgreSQL is not an ISO string returned by JSON transport.
The generated time field above makes that distinction explicit. A complete RPC
contract must similarly choose suitable JSON codecs for each transported field;
these tests cover the database boundary, not decimal/date RPC serialization.

## Invalid persisted values fail before they reach application code

The tests deliberately write valid SQL values that violate the model:

- A JSON object with a string `attempts` fails native `findById` with
  `SchemaError`.
- JSON `null` fails `findMany({ select: ["details"] })`, because the object
  schema does not permit it. JSON null is distinct from SQL NULL.
- PostgreSQL numeric `NaN` fails the BigDecimal decoder on a selected read.

Each malformed write and subsequent read occurs inside `sql.withTransaction`.
The decode failure escapes that transaction; the following public repository
read proves rollback restored the previous value. A decoder alone does not undo
a write: callers must put the write and decoding boundary inside the transaction
whose rollback they need. Catching the failure inside that transaction would
change the outcome.

## Deliberate limits

Use `timestamptz` for instants and accept millisecond precision only where the
application can tolerate it. The test also reads SQL-formatted microseconds to
prove PostgreSQL still stores `.345678` when JS has decoded only `.345`.
Timestamp-without-time-zone to Date is documented driver behavior, not the
framework's recommended universal time representation.

Applications needing exact microseconds, a timezone-free calendar value, or
PostgreSQL infinity require an explicit encoding/parser policy before adoption.
The driver exposes `PgClient.layer({ types: ... })`, but this slice does not
introduce custom parsers, globally alter OIDs, or imply that changing a schema
can recover precision already discarded by a driver.

JSON validation cannot recover precision lost by the driver's JSON parser either.
Store exact decimal values in JSON as strings with explicit codecs when needed.
This slice proves ordinary object JSON; JSON arrays/scalars as top-level bind
parameters, JSON operators/filtering, date-only columns, bigint IDs, arrays,
enums, ranges, binary data, and custom type parser policies remain unproven.
`findMany` still supports only its existing selected fields, equality filters,
ordering and limit; the tests add no query DSL or relationship engine.

## Run the proof

```sh
PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://... \
  pnpm heavy pnpm --filter @shivaedev/effect-sql exec vitest run test/postgres-codecs.test.ts
```

The suite skips when the variable is absent. It has also been run with both
`TZ=UTC` and `TZ=America/New_York` to distinguish absolute timestamptz behavior
from process-local timestamp interpretation. This is a focused codec proof,
not exhaustive coverage of PostgreSQL's type system or DST transitions.
