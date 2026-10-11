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

`makePostgresTestLayer` creates a template database through an administrative connection, runs `migratePostgres` and optional fixtures there, then closes its preparation connections. It creates a shared test database from that template and provides `SqlClient`, `PgClient`, `Reactivity` and `PostgresTestDatabase`. The template remains closed and unchanged while tests run. Each isolated database is another copy of that template; its migrations and fixtures do not run again.

The Layer's scope owns the template, shared database and their connections. `makeEffectIt` builds the Layer once for its worker fixture. Each test's wrapper owns the transaction or isolated database. Closing those scopes releases the connections and drops the disposable databases; the administrative database named by `url` remains in place.

Define the tester in test support:

```ts
import { expect } from "vitest";
import { Config, Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withTestTransaction } from "@shivaedev/effect-test-sql/withTestTransaction.ts";

const layer = makePostgresTestLayer({
  url: Redacted.make(Effect.runSync(Config.string("TEST_DATABASE_URL"))),
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

Use the application's migration loader in place of the example. `migrations` takes the existing `PostgresMigrationOptions`: `loader`, `lockTimeout`, and an optional ledger `table`. Fixtures are an Effect with access to the native PostgreSQL services. Additional migration or fixture dependencies remain requirements of the Layer and must be supplied before passing it to the runner. Setup failures remain failures; acquired databases are dropped when the acquisition scope closes.

### Ordinary tests: rollback

`around: withTestTransaction` wraps harness acquisition, the body and their scope finalizers. Success returns the body's value after rollback. Typed failures, defects and interruption also roll back and retain their failure kind. A nested `transact` uses the native savepoint path: a rejected nested write can roll back without losing earlier writes in the test. Commit-bound invalidations stay buffered and are discarded when the wrapping transaction rolls back.

Tests may run concurrently on the shared database, with separate transaction connections. Other tests do not see uncommitted writes. PostgreSQL still enforces row locks and unique constraints: updates to the same keyed row, or inserts with the same unique key, can wait until the first test rolls back. Do not make tests wait for each other after acquiring conflicting locks. Use different keys or isolated databases when a scenario needs overlapping writes without that contention.

PostgreSQL sequence advances survive rollback. Avoid asserting exact generated sequence numbers on the shared database; use an isolated database when its sequence state must start from the template.

### Real commits: an isolated database

Use `withIsolatedDatabase` for after-commit effects, LISTEN/NOTIFY, advisory-lock scenarios that need independent connections, migration tests, or work through several connections. It runs without a wrapping transaction on its clone. Ordinary autocommit and `transact` commit for real, and the clone is dropped when the wrapper finishes.

An isolated block can live inside the rollback tester above:

```ts
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";

effectApp("commits in its own database", function* () {
  yield* withIsolatedDatabase(Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`update items set name = 'Committed' where id = 1`;
  }));
});
```

The clone starts from the template, including the original fixtures, even if the shared database has changed. The outer rollback transaction belongs to a different native client and does not wrap the clone's work. To isolate harness acquisition and the entire body instead, define a tester with `around: withIsolatedDatabase`.

Inside an isolated block, `PostgresTestDatabase.url` names that clone. Use it to acquire additional native PostgreSQL connections in the block's scope. Native SQL services are replaced in the block's Context; application services acquired earlier retain the client they captured. Build application service Layers inside the isolated block when they acquire SQL clients; use `Layer.fresh` when reusing a Layer definition already acquired by the worker. Keep servers and background fibers in that scope so they finish before the database is dropped. Separate databases isolate database contents; external services and server capacity need separate planning.

### API

Import each name from the module that defines it. The package has no root entry.

| Module | Exports |
| --- | --- |
| `@shivaedev/effect-test-sql/postgres.ts` | `makePostgresTestLayer({ url, migrations, fixtures? })`, `PostgresTestOptions` |
| `@shivaedev/effect-test-sql/withTestTransaction.ts` | `withTestTransaction(effect)` |
| `@shivaedev/effect-test-sql/withIsolatedDatabase.ts` | `withIsolatedDatabase(effect)` |
| `@shivaedev/effect-test-sql/database.ts` | `PostgresTestDatabase`, `PostgresTestDatabaseService`, `PostgresTestServices` |

`url` is a redacted PostgreSQL URL for an existing administrative database. `PostgresTestDatabase` supplies the current database's redacted `url` and a scoped `isolated` Effect that acquires another clone's service Context. Prefer `withIsolatedDatabase` to acquire and release that Context around a test. Wrappers retain the body's result, failures and unmet service requirements, with native `SqlError` added for acquisition or transaction failures. Cleanup failures are defects rather than successful cleanup.

### Install, setup and evidence

```sh
pnpm add --save-dev @shivaedev/effect-test-sql @shivaedev/effect-test @effect/sql-pg @effect/vitest effect vitest
```

Use versions compatible with the package's peer dependencies. The package requires Node.js 24 or later. The PostgreSQL role must be able to create and drop databases; use a dedicated test server. PostgreSQL 13 or later supports the forced database drops used for cleanup. The migrations and fixtures must complete their work during preparation; their scoped resources are closed before cloning.

The package tests use `PLATFORM_EFFECT_TEST_SQL_TEST_DATABASE_URL`. Repository setup and CI prepare that database on real PostgreSQL. Local tests skip when that variable is absent; CI rejects its absence. The PostgreSQL tests prove overlapping same-row visibility, shared-key lock contention and release, rollback, nested savepoints, runner/harness scope composition, one-time template preparation, commits visible through another connection, and database cleanup. Compiler and packed-consumer tests prove the exercised public type and export contracts. These are library checks, not evidence for an application's servers or notification delivery.
