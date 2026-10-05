# Native SQL migrations

Use Effect's existing migration runner directly. Platform does not add a migration
engine, schema-diff generator, or CLI in this slice. A migration is an ordinary
Effect that uses the same `SqlClient` as application repositories.

## Start with numbered effects

```ts
import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";

const createOrders = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`create table orders (
    id integer primary key,
    name text not null unique
  )`;
});

const seedOrders = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`insert into orders (name) values ('Printer paper')`;
});

export const migrate = Migrator.make({})({
  loader: Migrator.fromRecord({
    "1_create_orders": createOrders,
    "2_seed_orders": seedOrders,
  }),
});
```

This example uses SQLite SQL. Provide the application's database Layer and run
`migrate` during its explicit initialization phase, before serving requests. Keep
the database scope alive for the application; a new in-memory SQLite connection
would create a separate empty database.

The first successful run returns `[[1, "create_orders"], [2, "seed_orders"]]`. Running
the same loader again returns `[]`. The default `effect_sql_migrations` table
records migration IDs, names, and creation timestamps. The native `table` option
can change its name without a Platform wrapper.

## What the native runner owns

- `fromRecord` sorts numbered effects by ID. IDs should be positive and increasing.
- `fromGlob` loads numbered modules with a default Effect export; `fromFileSystem`
  adds filesystem/path service requirements. Choose packaging conventions when an
  application needs file discovery.
- The runner ensures the ledger exists and runs the pending batch through
  `SqlClient.withTransaction`, including its ledger entries.
- A migration-body failure aborts the batch. In Effect `4.0.0-rc.112`, the runner
  wraps a typed body failure in a `MigrationError` defect with `kind: "Failed"`.
  Startup should fail visibly; catching only the typed error channel does not
  capture this failure. A caller inspecting completion can use `Effect.exit`.

The [PostgreSQL tests](../../packages/effect-sql/src/postgresMigrations.spec.ts)
exercise `migratePostgres` for creation, upgrades, reruns and failed batches.
The [PostgreSQL guide](./postgres-migrations.md) describes concurrent runners and
lock timeouts. Native SQLite migration behavior belongs to Effect; the example
above does not establish transactional DDL behavior for every database.

## Policies deliberately left open

The current runner uses the highest applied ID as its cutoff. It does not replay
an added migration below that cutoff, and its ledger does not checksum migration
contents. Treat applied migrations as immutable and append higher IDs. Whether
Platform should enforce checksums or reject out-of-order history remains a
separate decision; this example adds neither behavior.

Nontransactional DDL, deployment serialization, existing-database baselining,
schema-diff generation, and a migration authoring CLI need concrete application
requirements before Platform chooses a policy. Database-specific operations that
cannot execute inside a transaction do not fit this runner's ordinary batch.

These migrations evolve application tables and data. They do not rebuild event
projections or introduce event sourcing. Repository models still describe the
application's expected row codecs; changing a model alone does not alter a table.

## Native API reference

The implementation targets the workspace-pinned Effect `4.0.0-rc.112` APIs:
[`Migrator`](https://github.com/Effect-TS/effect/blob/effect%404.0.0-rc.112/packages/effect/src/unstable/sql/Migrator.ts).
The executable test is the local compatibility check when the dependency changes.
