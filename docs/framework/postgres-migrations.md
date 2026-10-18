# PostgreSQL migrations

Use `migratePostgres` from `@shivaedev/effect-sql/migrations.ts` with Effect's numbered migration
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

The [migration tests](../../packages/effect-sql/src/postgresMigrations.spec.ts)
and [bootstrap tests](../../packages/effect-sql/src/postgresMigrationBootstrap.spec.ts)
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

## Check the ledger before serving

`assertPostgresMigrations` from `@shivaedev/effect-sql/assertPostgresMigrations.ts` checks that the loader's migration IDs and names are present in the ledger. It does not execute migrations or create the ledger. Missing or pending migrations and a mismatched name fail with `MigrationError`. The [readiness tests](../../packages/effect-sql/src/postgresMigrationReadiness.spec.ts) check those failures, acceptance after migration and acceptance of a loader whose entries are a subset of the applied ledger.

Pass `migrations: { loader: migrations, table: "app_migrations", mode: "check" }` to `appHost` to use this assertion during database initialization. The starter uses check mode for its web and worker processes; run `pnpm migrate` separately to apply migrations. Its [deployment readiness tests](../../examples/starter/src/server/deployReadiness.spec.ts) check that both processes refuse an unmigrated database without creating the ledger, then start after the migration command, and that rerunning the command preserves ledger entries and rows. This checks the ledger, not table structure or edited migration content.

## Application decisions

`lockTimeout` covers lock waits, including migration DDL. It does not bound the
migration's running time. Choose a deployment or statement timeout separately.
The advisory lock is scoped to the database and keyed by the ledger name.

Use immutable, increasing migration IDs. The ledger records applied migrations;
it does not detect edited migration content or schema drift. Transactional
rollback covers the tested table creation and inserts. Concurrent indexes,
external side effects, process crash recovery and rollout compatibility require
application-specific verification. Use the ledger assertion for startup readiness; migration file discovery and additional operational interfaces remain application choices.

```sh
PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://... \
  pnpm heavy pnpm --filter @shivaedev/effect-sql test src/postgresMigrations.spec.ts src/postgresMigrationBootstrap.spec.ts
```

The tests skip without the database URL. The workspace CI supplies a PostgreSQL
service; a skipped local run provides no PostgreSQL evidence.
