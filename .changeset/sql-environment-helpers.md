---
"@shivaedev/sql": minor
---

### Breaking

- Low-level SQL helpers read `SqlClient` from Effect's environment. Remove the explicit client argument from `aggregateColumn`, `makeInsertMany`, `makeCompositeCrud`, `makeConditionalUpsert`, `makeConflictWrites`, `makeInsertFromSelect`, `latestPerGroup`, `makeAggregate`, `makeConflictClause`, `makeQueryClauses`, `makeFilter`, `makeQueries`, `repositoryWrites`, `upsertReturning`, `makeVersionedWrites` and `versionedStatements`, and yield their returned Effects to construct the helper. For example, replace `makeFilter(model, sql)` with `yield* makeFilter(model)` inside an Effect with `SqlClient` provided. Constructed repository operations retain their client.
- Remove the client argument from `repositoryChanges`, `pinnedGroups` and `tuplePredicate`, and provide `SqlClient` in the environment when running their Effects. `makeRepository` and its returned operations keep their existing signatures and behavior.
