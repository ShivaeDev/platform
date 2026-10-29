# Native SQL migrations

Author numbered migrations with Effect's migration loaders. Use `migratePostgres` for PostgreSQL runner serialization and `assertPostgresMigrations` for a startup ledger check, as described in the [PostgreSQL guide](./postgres-migrations.md). A migration is an ordinary Effect that uses the same `SqlClient` as application repositories.

## Start with numbered effects

```ts
import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";

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

This example uses SQLite SQL. Provide the application's database Layer and run `migrate` during its explicit initialization phase, before serving requests. Keep the database scope alive for the application; a new in-memory SQLite connection would create a separate empty database.

The first successful run returns `[[1, "create_orders"], [2, "seed_orders"]]`. Running the same loader again returns `[]`. The default `effect_sql_migrations` table records migration IDs, names, and creation timestamps. The native `table` option can change its name without a Platform wrapper.

## What the native runner owns

- `fromRecord` sorts numbered effects by ID. IDs should be positive and increasing.
- `fromGlob` loads numbered modules with a default Effect export; `fromFileSystem` adds filesystem/path service requirements. `migrationsFromDirectory(root)` from `@shivaedev/sql/migrationsFromDirectory.ts` uses `fromFileSystem` on the conventional `src/server/migrations` folder under `root`.
- The runner ensures the ledger exists and runs the pending batch through `SqlClient.withTransaction`, including its ledger entries.
- A migration-body failure aborts the batch. The runner wraps a typed body failure in a `MigrationError` defect with `kind: "Failed"`. Startup should fail visibly; catching only the typed error channel does not capture this failure. A caller inspecting completion can use `Effect.exit`.

## Ledger policy

The native runner uses the highest applied ID as its cutoff. It does not replay an added migration below that cutoff, and its ledger does not checksum migration contents. `migratePostgres` refuses such a migration instead of skipping it: a loaded ID at or below the latest applied ID that is missing from the ledger fails with `MigrationError` (`kind: "BadState"`) before the batch runs. Treat applied migrations as immutable and append higher IDs; Platform does not checksum their contents.

`migratePostgres` serializes runners for the same ledger with a PostgreSQL advisory lock. Database-specific operations that cannot execute inside a transaction, such as nontransactional DDL, do not fit this runner's ordinary batch. Platform has no existing-database baselining, schema-diff generation or migration authoring CLI.

These migrations evolve application tables and data. They do not rebuild event projections or introduce event sourcing. Repository models still describe the application's expected row codecs; changing a model alone does not alter a table.
