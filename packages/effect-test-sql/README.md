# @shivaedev/effect-test-sql

PostgreSQL tests should start from known data and leave it there. This package prepares migrations and fixtures once, wraps ordinary Effect tests in transactions that roll back, and clones the prepared database when a test needs real commits.

## Why you want this

Table cleanup couples tests to the order they run. A rollback test keeps its writes private and restores the prepared data when it ends:

```ts
effectApp("renames an item", function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`update items set name = 'Renamed' where id = 1`;
  expect(yield* sql`select name from items where id = 1`).toEqual([
    { name: "Renamed" },
  ]);
});
```

The next test still sees the original name. Tests that must observe a committed write use a disposable database copied from the same starting data.

## Using it

### Prepare one fixture

`makePostgresTestLayer` creates an empty template and a migrated template through an administrative connection, runs `migratePostgres` and optional fixtures in the migrated template, then closes its preparation connections. It creates a shared test database from the migrated template and provides `SqlClient`, `PgClient`, `Reactivity` and `PostgresTestDatabase`. The templates remain closed and unchanged while tests run. Each isolated database copies the template it asks for; migrations and fixtures do not run again when cloning. Set `prepare: false` for a suite that needs only empty databases: both migrations and fixtures are skipped.

The Layer's scope owns the template, shared database and their connections. `makeEffectIt` builds the Layer once for its worker fixture. Each test's wrapper owns the transaction or isolated database. Closing a test scope releases its connections and queues its database drop in the background. Closing the Layer waits for all queued drops. To wait earlier, run `PostgresTestDatabase.awaitCleanup` after the isolated scope ends; it waits for drops queued before that Effect starts and reports cleanup failures as SQL defects. The shared database and templates stay available; the administrative database named by `url` remains in place.

Define the tester in test support:

```ts
import { expect } from "vitest";
import { Config, Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { makeEffectIt } from "@shivaedev/effect-test/makeEffectIt.ts";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/server/postgres.ts";
import { withTestTransaction } from "@shivaedev/effect-test-sql/server/withTestTransaction.ts";

const layer = makePostgresTestLayer({
  url: Redacted.make(Effect.runSync(Config.String("TEST_DATABASE_URL"))),
  migrations: {
    lockTimeout: "5 seconds",
    loader: Migrator.fromRecord({
      "1_create_items": Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`create table items (id integer primary key, name text not null)`;
      }),
    }),
  },
  fixtures: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`insert into items values (1, 'Original')`;
  }),
});

export const { effectApp } = makeEffectIt({
  layer,
  clock: "live",
  around: withTestTransaction,
  makeHarness: () => Effect.void,
});
```

Use the application's migration loader in place of the example. `migrations` takes effect-sql's `PostgresMigrationOptions`. Fixtures are an Effect with access to the native PostgreSQL services. Additional migration or fixture dependencies remain requirements of the Layer and must be supplied before passing it to the runner. Setup failures remain failures; acquired databases are dropped when the acquisition scope closes.

Fixtures can also be a `PostgresTestLoader`: a callback from the migrated template's redacted URL to a scoped Effect. Use it when a loader needs application options with its own pool, such as Better Auth's options. Acquire the pool in that Effect with `Effect.acquireRelease` and close it in the release action. The callback runs once during preparation, after migrations, with the native SQL services available. Its resources close before the first clone. For example, a loader using a separate native PostgreSQL client can be written as:

```ts
import * as PgClient from "@effect/sql-pg/PgClient";

const layer = makePostgresTestLayer({
  url,
  migrations: appMigrations,
  fixtures: (templateUrl) => Effect.gen(function* () {
    const client = yield* PgClient.makeClient({ url: templateUrl });
    yield* client`create table app_fixture (name text not null)`;
    yield* client`insert into app_fixture values ('Original')`;
  }),
});
```

### Reuse the app's SQL name mapping

`PostgresTestOptions` accepts effect-sql's native `transformQueryNames` and `transformResultNames`. Spread the same options returned by `clientOptions` that the app host uses; the test layer carries them into preparation, the shared database, `withIsolatedDatabase` and story clones:

```ts
const layer = makePostgresTestLayer({
  ...appClientOptions,
  url: testDatabaseUrl,
  migrations: appMigrations,
});
```

Declare the mapping once in `appClientOptions`, for example with `clientOptions(config, { snakeCase: true })`. The test URL selects the administrative database independently of the app's database URL. Omitting transforms preserves SQL names.

### Budget PostgreSQL connections

Each database pool opens connections on demand, with a default maximum of **two**: the shared database can use two, and each active per-test or per-story clone can use another two. Preparation uses the same limit and closes before tests start. An administrative connection exists only during a create or drop operation and closes as soon as that operation finishes; idle workers keep no administrative connection. Set `maxConnections` on `makePostgresTestLayer` to override the limit for the suite's preparation, shared and isolated pools:

```ts
const layer = makePostgresTestLayer({
  url,
  migrations,
  maxConnections: 3,
});
```

Allow at least three shared connections when two tests hold transactions while a third connection inspects locks. A listener, stream or reserved transaction holds a pool slot until its scope closes; a suite that waits for more simultaneous reservations than its pool allows can stall. Additional clients that the application creates have their own connection budgets.

For `W` active workers with one fixture and at most `C` simultaneous clones each, allow up to `W × maxConnections × (1 + C)` pooled connections, plus one transient administrative connection per concurrent create/drop operation. Add other application clients and leave room for PostgreSQL's reserved slots and other users of the server. With stock `max_connections = 100`, four workers with one clone each use at most 16 pooled connections at the default limit, plus transient administration connections. Vitest's default worker count depends on the machine; use this budget when a larger machine or concurrent stories can exceed the server's capacity.

Setup and the test wrappers report PostgreSQL's connection-limit failure (`53300`) with `max_connections` and a suggestion to try `vitest run --maxWorkers=4`. Reduce `maxConnections` or concurrent clones, or increase the server budget, if four workers still need too many connections. Other SQL failures retain their original errors.

### Ordinary tests: rollback

`around: withTestTransaction` wraps harness acquisition, the body and their scope finalizers. Success returns the body's value after rollback. Typed failures, defects and interruption also roll back and retain their failure kind. A nested `transact` uses the native savepoint path: a rejected nested write can roll back without losing earlier writes in the test. Commit-bound invalidations stay buffered and are discarded when the wrapping transaction rolls back.

Tests may run concurrently on the shared database, with separate transaction connections. Other tests do not see uncommitted writes. PostgreSQL still enforces row locks and unique constraints: updates to the same keyed row, or inserts with the same unique key, can wait until the first test rolls back. Do not make tests wait for each other after acquiring conflicting locks. Use different keys or isolated databases when a scenario needs overlapping writes without that contention.

PostgreSQL sequence advances survive rollback. Avoid asserting exact generated sequence numbers on the shared database; use an isolated database when its sequence state must start from the template.

### Real commits: an isolated database

Use `withIsolatedDatabase` for after-commit effects, LISTEN/NOTIFY, advisory-lock scenarios that need independent connections, migration tests, or work through several connections. It runs without a wrapping transaction on its clone. Ordinary autocommit and `transact` commit for real, and the wrapper queues its clone for background cleanup when it finishes. The Layer waits for cleanup at the end of its scope.

An isolated block can live inside the rollback tester above:

```ts
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";

effectApp("commits in its own database", function* () {
  yield* withIsolatedDatabase(Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`update items set name = 'Committed' where id = 1`;
  }));
});
```

The clone starts from the template, including the original fixtures, even if the shared database has changed. The outer rollback transaction belongs to a different native client and does not wrap the clone's work. To isolate harness acquisition and the entire body instead, define a tester with `around: withIsolatedDatabase`.

Inside an isolated block, `PostgresTestDatabase.url` names that clone. Use it to acquire additional native PostgreSQL connections in the block's scope. Native SQL services are replaced in the block's Context; application services acquired earlier retain the client they captured. Build application service Layers inside the isolated block when they acquire SQL clients; use `Layer.fresh` when reusing a Layer definition already acquired by the worker. Keep servers and background fibers in that scope so they finish before the database is dropped. Separate databases isolate database contents; external services and server capacity need separate planning.

### Choose an empty database per story or trait

The default clone is migrated. A first-deploy or upgrade block can select the empty template from the same Layer:

```ts
yield* withIsolatedDatabase(Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  expect(yield* sql`select table_name from information_schema.tables where table_schema = 'public'`).toEqual([]);
}), { template: "empty" });
```

For a `test-story` kit that chooses through traits, keep a `template: PostgresTestTemplate` field on its engine, initially `"migrated"`. Add a database stage before the stages that boot the app. A trait in that stage sets `engine.template = "empty"`; the stage's `after` hook acquires `yield* database.clone(engine.template)` from `PostgresTestDatabase`. Run app acquisition and verbs with `Effect.provideContext(services)` using that returned Context. The story's Scope owns the clone and its connections. Do not also use `around: withIsolatedDatabase` for this kit, since that would acquire a migrated clone before the traits run.

Both selections copy a closed PostgreSQL template with `CREATE DATABASE ... TEMPLATE`; neither selection executes migrations or fixture loaders. The amount of preparation work does not add per-clone migration or loader work. PostgreSQL still has to copy the template's stored data.

### Test a backfill against existing rows

A backfill needs rows in the old schema. Prepare an empty template with the application's own `PostgresMigrationOptions`, then use `migrationSteps` inside `withIsolatedDatabase`. `migrateTo` accepts the migration name as written without a file extension (`"001_create_contacts"`), its unpadded form (`"1_create_contacts"`), or its bare numeric id (`1`, `"1"` or `"001"`). It commits migrations through that target; seed rows with the native SQL client, then yield `migrateToLatest` to apply the remaining migrations on the same database.

This example uses an application loader whose `001_create_contacts` migration creates `contacts(id, email)`, `002_backfill_emails` creates `emails(contact_id, address)` and copies the contact email addresses into it, and `003_drop_email` drops `contacts.email`:

```ts
import { migrationSteps } from "@shivaedev/effect-test-sql/server/migrationSteps.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { appMigrations } from "./migrations.ts";

const migrationLayer = makePostgresTestLayer({
  url,
  migrations: appMigrations,
  prepare: false,
});

const { effectApp: migrationTest } = makeEffectIt({
  layer: migrationLayer,
  clock: "live",
  around: withIsolatedDatabase,
  makeHarness: () => migrationSteps(appMigrations),
});

migrationTest("preserves contact emails in the new table", function* (steps) {
  yield* steps.migrateTo("001_create_contacts");
  const sql = yield* SqlClient.SqlClient;
  yield* sql`insert into contacts (id, email) values (1, 'alice@example.test')`;
  yield* steps.migrateToLatest;
  expect(yield* sql`select contact_id, address from emails`).toEqual([
    { contact_id: 1, address: "alice@example.test" },
  ]);
});
```

The helper resolves the loader once and uses `migratePostgres` for each step, preserving its ledger table and lock timeout. Unknown or ambiguous targets fail with a typed `MigrationError` that names the requested target. Moving behind an already applied migration and running inside a wrapping transaction also fail with `MigrationError`. Loader dependencies, including `Scope`, remain requirements of `migrationSteps`; its resources live until the caller's scope closes. Use the returned steps inside that database's scope. SQL and loader failures retain their failure channels.

For test-story, use the same Layer and `around: withIsolatedDatabase`, acquire `migrationSteps(appMigrations)` in the kit's `create`, and let schema and data traits call `migrateTo` and seed native SQL. A verb can yield `migrateToLatest` before the story asserts the backfilled rows.

### Check upgrades against the current model

A fresh-database test cannot prove that older databases upgrade to the current model. Run `migrationUpgrade` in a disposable database with an empty migration ledger, outside a wrapping transaction. It resolves the application's loader once, commits migrations through the existing `upTo` id, then applies the remaining migrations through `migratePostgres`. It returns the target table's column names and PostgreSQL `format_type` strings, including type modifiers such as `numeric(10,2)`; dropped columns are excluded.

```ts
import { assertModelColumns } from "@shivaedev/effect-test-sql/server/assertModelColumns.ts";
import { migrationUpgrade } from "@shivaedev/effect-test-sql/server/migrationUpgrade.ts";

const columns = yield* migrationUpgrade({
  migrations: appMigrations,
  upTo: 1,
  table: "items",
});
yield* assertModelColumns(columns, Item, {
  id: "integer",
  name: "text",
  price: "numeric(10,2)",
});
```

Use `prepare: false` when preparing the test Layer, and `withIsolatedDatabase` for the upgrade test. The helper requires the native `SqlClient`; loader dependencies remain Effect requirements. Unknown starting ids, populated ledgers and wrapping transactions fail with `MigrationError`. Native loader and SQL failures retain their failure channel.

With a PostgreSQL client in the current Context, the assertion compares names through that client's query and result name transforms and reports problems in model field terms. Without a client or configured transforms it compares literal names.

The assertion uses the SQL `Model`'s selected database fields, including generated ids and excluding JSON-only fields. Supply an exact PostgreSQL type for every field: schemas such as `Schema.Number` do not determine whether storage is `integer`, `numeric` or `double precision`. It fails with a typed `ModelColumnMismatch` containing all detected missing, extra and wrongly typed column problems. The type map is checked against the model both by TypeScript and at runtime. This check covers names and types; it does not check defaults, nullability, constraints or application data transformations.

### API

Import each name from the module that defines it. The package has no root entry.

| Module | Exports |
| --- | --- |
| `@shivaedev/effect-test-sql/server/postgres.ts` | `makePostgresTestLayer({ url, migrations, fixtures?, maxConnections?, prepare?, transformQueryNames?, transformResultNames? })`, `PostgresTestOptions`, `PostgresTestLoader` |
| `@shivaedev/effect-test-sql/server/withTestTransaction.ts` | `withTestTransaction(effect)` |
| `@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts` | `withIsolatedDatabase(effect, { template? }?)` |
| `@shivaedev/effect-test-sql/server/database.ts` | `PostgresTestDatabase`, `PostgresTestDatabaseService`, `PostgresTestServices`, `PostgresTestTemplate` |
| `@shivaedev/effect-test-sql/server/migrationSteps.ts` | `migrationSteps(appMigrations)` returning `{ migrateTo(name), migrateToLatest }` |
| `@shivaedev/effect-test-sql/server/migrationUpgrade.ts` | `migrationUpgrade({ migrations, upTo, table })`, `MigrationUpgradeOptions`, `PostgresColumn` |
| `@shivaedev/effect-test-sql/server/assertModelColumns.ts` | `assertModelColumns(columns, model, types)`, `ModelColumnMismatch` |

`url` is a redacted PostgreSQL URL for an existing administrative database. `PostgresTestDatabase` supplies the current database's redacted `url`, an `awaitCleanup: Effect<void>` drain, a scoped `isolated` Effect that acquires a migrated clone's service Context, and `clone(template)` for an explicit `"empty"` or `"migrated"` choice. With `prepare: false`, both choices are empty. Prefer `withIsolatedDatabase` to acquire and release that Context around a test. Wrappers retain the body's result, failures and unmet service requirements, with native `SqlError` added for acquisition or transaction failures. Cleanup failures surface as SQL defects when the Layer closes. Drops that fail with connection exhaustion (SQLSTATE `53300`) retry every 100 ms of live time for up to 300 retries, even while a test clock is paused; if capacity does not return, the SQL defect remains visible. Startup sweeps databases left by dead processes on the same host and databases from the older unowned naming format. Databases owned by live processes or another host are retained, so local parallel workers keep their databases. Use the same host to reclaim its abandoned databases.

### Install and setup

```sh
pnpm add --save-dev @shivaedev/effect-test-sql @shivaedev/effect-test @effect/sql-pg @effect/vitest effect vitest
```

Use versions compatible with the package's peer dependencies. The package requires Node.js 24 or later. The PostgreSQL role must be able to create and drop databases; use a dedicated test server. PostgreSQL 13 or later supports the forced database drops used for cleanup. The migrations and fixtures must complete their work during preparation; their scoped resources are closed before cloning.
