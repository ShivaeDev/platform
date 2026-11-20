# @shivaedev/sql

You are changing Platform's persistence and migration path for native Effect applications. A feature should describe its row once with an Effect model, get ordinary repository operations from it, and use native SQL for the query that needs more. A write's changed keys must follow the database that committed it. Migration runners must agree on one ledger without a second migration engine. The usage guide is in [README.md](README.md).

## Which way to lean

When goals conflict, they win in this order:

1. **Native Effect owns the database lifecycle.** Keep `SqlClient`, model variants, typed failures, scopes, interruption, transactions and savepoints visible. Do not create a second pool, transaction engine or migration engine. Preserve native update shapes, savepoints and migration-body defects instead of turning them into partial patches or ordinary typed failures.
2. **Changes follow the committing database.** Keep one change owner per native client. Announce keys after its outermost commit, discard rolled-back keys, and refuse a transaction whose commit cannot be observed. A publication failure must not make a committed write look safe to retry.
3. **One model and one SQL path.** Derive inputs, filters and results from the model's schemas. Add a repository helper only for repeated application work; keep explicit SQL available for joins and exceptional queries. Authorization, tenant policy and SQL DDL remain with the application.
4. **A codec claim has database evidence.** Match the values the driver actually returns. A SQLite test does not prove PostgreSQL behavior, a type test does not prove runtime behavior, and a skipped integration test proves nothing.
5. **Small helpers over hidden policy.** Reuse `changes` for commit ownership and native Migrator for execution. Leave storage compatibility, larger query APIs and migration policies open until the maintainer chooses them from a concrete need. The package does not infer SQL schemas, generate migrations, load relations, scope tenants or ship a migration CLI or deployment coordinator.
