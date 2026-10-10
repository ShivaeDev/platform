# Roadmap

This file owns the implementation status of repositories, SQL transaction changes and the PostgreSQL migration helper. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed application fixtures, host startup and migration authoring or deployment conventions. A task's status belongs in one of those places.

## Built

- [x] Native model-derived CRUD with a narrow `findMany`: equality filters, selected field types and decoders, one sort field and a limit. Codec services stay in the environment; undefined filters are unconstrained and unknown runtime field names fail with `SchemaError`. [SQLite and type evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/repository.test.ts), [installed type consumer](https://github.com/ShivaeDev/platform/blob/main/script/package-check/fixtures/effect-sql/types.ts.txt).
- [x] Repository writes participate in caller-owned native transactions. [SQLite evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/repository.test.ts) and [PostgreSQL evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/postgres.spec.ts) cover rollback, generated identities, nullable filters, encoded text, selection, ordering and limits.
- [x] PostgreSQL storage cases for precise numeric values, dates, ordinary JSON/JSONB objects, nullability and generated values. Malformed persisted JSON and numeric `NaN` fail decoding and roll back the enclosing transaction. Timestamp tests distinguish millisecond instants from process-local wall time. [Codec evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/postgresCodecs.spec.ts).
- [x] Known named unique constraints can become domain failures after rollback while unrelated SQL failures retain native detail. [Constraint evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/postgresConstraints.spec.ts).
- [x] `transact` and `invalidateOnCommit` bind `effect-changes` to native SQL and Reactivity. Same-client savepoints merge only successful keys; independent clients commit independently; keys follow their own client; late recording and unmanaged native outer transactions are refused. [SQLite evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/transact.test.ts), [PostgreSQL evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/postgresTransact.spec.ts), [type evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/transact.typecheck.test.ts).
- [x] Invalidation follows real PostgreSQL commit visibility, including interruption while `COMMIT` is in flight. Failed publication logs without changing the committed result. [Commit evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/transactCommit.spec.ts), [SQLite publication evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/transactSink.spec.ts).
- [x] `migratePostgres` serializes fresh and existing ledger runners with a transaction-scoped advisory lock and an explicit lock timeout. Fresh, upgraded and repeated runs return their applied migrations; failed batches roll back their DDL, data and ledger changes. Lock timeout failures are typed; migration-body failures retain native defects. [Migration evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/postgresMigrations.spec.ts), [bootstrap and timeout evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-sql/src/postgresMigrationBootstrap.spec.ts).

The PostgreSQL suites skip without `PLATFORM_EFFECT_SQL_TEST_DATABASE_URL`. Their presence is separate from a run that actually supplies a disposable database.

## Next

- [ ] Establish a supported field/storage matrix from concrete consumers, extending the tested cases where needed. Broader PostgreSQL coverage needs direct evidence for bigint identities, date-only values, arrays, enums, ranges, binary data, exact sub-millisecond time and custom parser policies.
- [ ] Use a consuming application's exceptional queries to decide whether more repository helpers remove repeated work without introducing a second database model.

## Open questions

- Which driver representations and parser configurations should the package promise to support, beyond the explicit default-parser cases in the codec tests? How should an application choose portable calendar values and exact time precision?
- Should repeated joins or aggregates grow the repository API, and if so which examples justify the shape? General SQL DSLs, inferred joins and automatic nested relationships remain maintainer decisions.
- Should migrations gain content checksums or reject edits to applied migrations? What policy should apply to an added migration below the native runner's applied-ID cutoff?
- Should nontransactional DDL get an explicit separate path, and what evidence would establish its recovery behavior? The existing helper runs a transactional batch.
- Is schema-diff generation needed at all, or should migrations remain authored SQL Effects? Migration CLI, file-discovery, startup and deployment conventions are framework work and need an application fixture.
