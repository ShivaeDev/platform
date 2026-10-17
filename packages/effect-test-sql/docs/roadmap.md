# Roadmap

## Built

- [x] Prepare migrations and optional fixtures once in a closed template database. [PostgreSQL tests](../src/server/postgres.test.ts) cover omitted fixtures; [isolation tests](../src/server/isolated.spec.ts) assert one-time preparation and cloning.
- [x] Supply native PostgreSQL services on a shared database with per-test rollback. [Transaction tests](../src/server/transaction.spec.ts) assert isolated visibility and rollback after success, typed failure, defects and interruption.
- [x] Compose the wrapping transaction with `makeEffectIt`, harness scopes and nested `transact` savepoints. [Runner stories](../src/server/vitest.spec.ts) assert harness and finalizer rollback; [transaction tests](../src/server/transaction.spec.ts) assert savepoint behavior.
- [x] Clone isolated databases for real commits and drop them after use. [Isolation tests](../src/server/isolated.spec.ts) assert committed clones and database cleanup.
- [x] Prove the database lifecycle against PostgreSQL and the public contracts with [compiler checks](../src/server/postgres.typecheck.test.ts) and [packed-consumer checks](../../../script/package-check/fixtures/effect-test-sql/types.ts.txt). [Scope cleanup tests](../src/server/isolated.spec.ts) assert template and shared database removal.

## Next

No additional package work is selected. Let application migration and test-isolation needs identify the next change.

## Open questions

No package scope questions are currently selected.
