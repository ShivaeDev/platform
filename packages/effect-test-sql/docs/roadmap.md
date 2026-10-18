# Roadmap

## Built

- Prepare migrations and optional fixtures once in a closed template database, supply native PostgreSQL services on a shared database, and roll back ordinary tests. [PostgreSQL lifecycle tests](../src/server/postgres.test.ts) and [transaction tests](../src/server/transaction.spec.ts) prove preparation and rollback.
- Compose the wrapping transaction with `makeEffectIt`, harness scopes and nested `transact` savepoints. [Runner tests](../src/server/vitest.spec.ts) and [application-layer tests](../src/server/applicationLayers.spec.ts) prove the composition.
- Clone isolated databases for real commits and drop them after success, typed failure, defects or interruption. [Isolation tests](../src/server/isolated.spec.ts) prove these lifetimes and worker cleanup; [cleanup failure tests](../src/server/cleanupFailure.spec.ts) prove a failed drop becomes a defect carrying the SQL failure.
- Start with an empty schema using `prepare: false`, then use `migrationSteps` to stop at named migrations, seed old-schema data and finish the upgrade on the same database. [Migration-step tests](../src/server/migrationSteps.test.ts) prove committed backfills and rejection of unknown names and wrapping transactions; [lifecycle tests](../src/server/migrationStepsLifecycle.spec.ts) prove empty preparation, scoped loader resources, resume and rejection of backwards steps.
- Use `migrationUpgrade` to commit an old migration prefix and apply the remaining migrations, then compare live PostgreSQL columns with an Effect SQL model using `assertModelColumns`. [Upgrade tests](../src/server/migrationUpgrade.test.ts) prove committed old data, exact column types, drift detection and invalid-state rejection; [model-column tests](../src/server/assertModelColumns.test.ts) prove model field and type comparisons.
- Default to two pooled connections per database, allow `maxConnections` overrides and close administrative sessions between operations. [Connection-budget tests](../src/server/connectionBudget.spec.ts) measure twelve concurrent databases with default and explicit pool sizes; [idle-cleanup tests](../src/server/postgresIdleCleanup.spec.ts) prove idle workers release their connections.
- Preserve SQLSTATE `53300` on connection exhaustion and add connection-limit and worker-count guidance. [Connection-limit tests](../src/server/connectionLimit.spec.ts) prove setup and wrapper diagnostics against PostgreSQL and preserve other SQL failures' identity.
- Check public contracts with [compiler tests](../src/server/postgres.typecheck.test.ts), [migration-step compiler tests](../src/server/migrationSteps.typecheck.test.ts), [upgrade compiler tests](../src/server/migrationUpgrade.typecheck.test.ts) and [packed-consumer checks](../../../script/package-check/fixtures/effect-test-sql/types.ts.txt).

## Next

No additional package work is selected. Let application migration and test-isolation needs identify the next change.

## Open questions

No package scope questions are currently selected.
