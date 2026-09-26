# PostgreSQL migrations

Use `migratePostgres` from `@shivaedev/effect-sql` with Effect's numbered migration
loaders. It serializes runners for one ledger, including the first run on an
empty database, and executes each pending batch in a transaction.

```ts
const migrations = Migrator.fromRecord({
  "1_create_orders": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`create table orders (id integer primary key, name text not null)`
  }),
  "2_add_notes": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`alter table orders add column notes text`
  })
})

const runMigrations = migratePostgres({
  table: "app_migrations",
  loader: migrations,
  lockTimeout: "30 seconds"
})
```

Provide the application's `PgClient` layer and complete migrations before serving
requests. Every runner of a ledger must use the same helper and ledger spelling.

## Tested behavior

The [migration tests](../../packages/effect-sql/test/postgres-migrations.test.ts)
and [bootstrap tests](../../packages/effect-sql/test/postgres-migration-bootstrap.test.ts)
call the public helper against PostgreSQL 18 with unique table names.

| Scenario | Result |
| --- | --- |
| Fresh database | Creates the ledger and applies the initial migration. |
| Upgrade | Applies only new numbered migrations. |
| Rerun | Returns no work and leaves persisted rows unchanged. |
| Failed pending batch | Rolls back its DDL, rows and ledger entries while retaining previously committed migrations. |
| Failed first batch | Rolls back the new ledger together with the batch. |
| Concurrent runners on a new or existing ledger | The second waits on an advisory lock, then sees the committed ledger. Each migration runs once. |
| Expired lock timeout | Fails with a typed `SqlError` whose reason is `LockTimeoutError`. |
| Infinite lock timeout | Sets PostgreSQL's transaction-local lock timeout to zero. |

Concurrency tests hold a migration with a Deferred, observe the second transaction blocked by the first
in PostgreSQL, and then release the first runner. They do not depend on a
sleep to establish ordering. Migration-body SQL failures propagate as native
`MigrationError` defects; a typed-error-only catch does not handle them.

## Application decisions

`lockTimeout` covers lock waits, including migration DDL. It does not bound the
migration's running time. Choose a deployment or statement timeout separately.
The advisory lock is scoped to the database and keyed by the ledger name.

Use immutable, increasing migration IDs. The ledger records applied migrations;
it does not detect edited migration content or schema drift. Transactional
rollback covers the tested table creation and inserts. Concurrent indexes,
external side effects, process crash recovery and rollout compatibility require
application-specific verification. Status commands and migration file discovery
remain application choices.

```sh
PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://... \
  pnpm heavy pnpm --filter @shivaedev/effect-sql test test/postgres-migrations.test.ts test/postgres-migration-bootstrap.test.ts
```

The tests skip without the database URL. The workspace CI supplies a PostgreSQL
service; a skipped local run provides no PostgreSQL evidence.
