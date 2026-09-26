# Native PostgreSQL migrations

Use Effect's existing `Migrator` for numbered, forward-only SQL migrations. The current implementation already provides the ledger, ordered loading, a PostgreSQL table lock and transactional execution. This proof does not justify a replacement migration engine.

The findings below are specific to the workspace's Effect `4.0.0-rc.112` and PostgreSQL 18. The executable evidence is [postgres-migrations.test.ts](../../packages/effect-sql/test/postgres-migrations.test.ts) and [postgres-migration-bootstrap.test.ts](../../packages/effect-sql/test/postgres-migration-bootstrap.test.ts); they use unique table and ledger names and drop them after each test.

## Proven behavior

| Scenario | Observed result |
| --- | --- |
| Fresh database | Creates the ledger and applies migration 1. |
| Upgrade | Applies only the new migration 2. |
| Rerun | Returns an empty migration list and leaves data unchanged. |
| Failed pending batch | Rolls back the batch's DDL, inserted rows and ledger entries; previously committed migrations remain. |
| Two concurrent runners, existing ledger | The second waits for an `ACCESS EXCLUSIVE` lock, then rereads the committed ledger and returns no work. The pending migration executes once. |
| SQL failure inside a migration | Produces a `MigrationError` defect with `kind: "Failed"`; a typed-error-only catch does not handle it. |
| Two concurrent native runners, empty database | One runner applies the batch; the other fails with a typed `SqlError` (`UniqueViolation`) from ledger creation. It is not retried or treated as "already locked". |
| Concurrent `migratePostgres` runners, empty database | The second waits on an advisory lock, then returns no work. Each migration executes once. |
| `migratePostgres` while another runner holds the lock | Fails after `lockTimeout` with a typed `SqlError` whose `reason._tag` is `"LockTimeoutError"`. |

The concurrency test holds the first runner inside its migration using a Deferred. It starts a second runner and queries PostgreSQL's `pg_locks` until it observes a waiting, ungranted `AccessExclusiveLock` on that exact ledger. Only then does it release the first runner. The assertion depends on an observed database lock rather than a timing guess.

## Minimal application shape

```ts
const migrate = Migrator.make({})

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

const runMigrations = migrate({
  table: "app_migrations",
  loader: migrations
})
// Provide the application's PgClient layer at the execution boundary.
```

When more than one process may run migrations, including against an empty database, use `migratePostgres` from `@shivaedev/effect-sql` instead of calling the migrator directly:

```ts
const runMigrations = migratePostgres({
  table: "app_migrations",
  loader: migrations,
  lockTimeout: "30 seconds"
})
```

It runs one outer transaction: `SET LOCAL lock_timeout`, a transaction-scoped advisory lock keyed by the ledger name, `CREATE TABLE IF NOT EXISTS` with the native ledger shape, then the unchanged native migrator. The native migrator's own transaction becomes a savepoint, so its table lock, id tracking and rollback behavior still apply. A failed batch on an empty database also rolls back the ledger creation. `lockTimeout` covers every lock wait in the transaction, including DDL inside migrations, and is rounded up to whole milliseconds (minimum 1 ms). `Duration.infinity` sets `lock_timeout = 0`, which PostgreSQL treats as waiting without limit. It does not bound migration running time; use `statement_timeout` or a deployment timeout for that.

`fromRecord` orders numbered keys. Native filesystem/glob loaders can replace the inline record once an application settles its build and deployment packaging. A command entrypoint should report a failed Exit and exit unsuccessfully, including defects; it should not catch a migration failure and proceed to start the application.

## Boundaries and open deployment decisions

- **The native migrator races on first-ever ledger creation.** The pinned source probes the ledger with `::regclass`, then issues `CREATE TABLE` if that fails, outside the migration transaction and lock. The bootstrap test makes this deterministic: an uncommitted ledger creation on a third connection keeps both runners' probes failing until both are observed blocked behind it in `pg_stat_activity`, then rolls back. An unsynchronized experiment with four native runners on 50 empty ledgers had exactly one success per ledger and three failures, as `UniqueViolation` or `SqlSyntaxError` (duplicate table). `migratePostgres` removes the race only when **every** runner for that ledger uses it. A plain native runner can still collide with it during bootstrap.
- **Native waiting is not fail-fast locking.** The native PostgreSQL path uses a blocking table lock without `NOWAIT` or a lock timeout. `migratePostgres` requires an explicit `lockTimeout`; the application still chooses the value and its failure handling. There is no library default.
- **The advisory lock key is a 64-bit hash of `effect_sql_migrations:<table>`.** It is scoped to the database. Unrelated advisory-lock users could collide with it in theory. Schema-qualified and unqualified spellings of the same ledger get different keys, so use one spelling per ledger.
- **The ledger is not schema drift detection.** The pinned source uses the highest applied id and skips all lower/equal ids. It does not compare migration content hashes. Use immutable, increasing migration ids; do not insert a historical migration and expect it to run.
- **Rollback is for transaction-compatible PostgreSQL operations.** This proof covers table creation and inserts. Operations such as concurrent index creation need a separate deployment design; remote HTTP calls or file writes are not rolled back with SQL.
- **Migration success is not application rollout compatibility.** Expand/contract changes, old/new application overlap, long-lived transactions, permissions and production-sized lock durations still need application-specific decisions.
- **This is one process with multiple real pooled database connections.** It proves PostgreSQL lock behavior between transactions, not process crash recovery or distributed deployment orchestration. The pool has enough connections for both runners and the lock observer.

The [general migration notes](migrations.md) also cover the SQLite proof. Before extracting a Platform migration command, decide the migration discovery/build contract, the lock timeout value and failure output. No automatic schema diffing, model-to-DDL generator or new migration DSL is introduced here.

## Run the proof

```sh
PLATFORM_EFFECT_SQL_TEST_DATABASE_URL=postgresql://... \
  pnpm heavy pnpm --filter @shivaedev/effect-sql exec vitest run test/postgres-migrations.test.ts test/postgres-migration-bootstrap.test.ts
```

Without that variable the PostgreSQL tests are explicitly skipped. Use an isolated test database whose role can create and drop tables. The workspace CI supplies the variable from its PostgreSQL service.

## Source inspected

The conclusions about locking, bootstrap and id tracking come from the installed `effect/src/unstable/sql/Migrator.ts`: `ensureMigrationsTable`, the `run` effect and `sql.withTransaction(run)`. Recheck those paths when upgrading the pinned Effect release; the tests preserve the observed transactional and existing-ledger concurrency contract.
