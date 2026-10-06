# Roadmap

This file owns effect-prisma's implementation status and backend questions. The framework roadmap owns application adoption and work that composes multiple packages; it does not repeat this package's feature checklist.

## Built

| Capability | Evidence |
| --- | --- |
| Prisma Next Database definitions and generated model types, including distinct identities for the same contract | `src/database.typecheck.test.ts`, `src/databaseTypes.typecheck.test.ts` |
| Immutable, reusable Relations, typed filtering and selection, first/exists/count | `src/internal/relation.spec.ts`, `src/database.typecheck.test.ts` |
| Related rows, nullable to-one values, nested/refined includes, counts and named projections | `src/database.test.ts`, `src/sqliteQueries.spec.ts`, `src/relation.typecheck.test.ts` |
| Bulk create/update/delete and count/grouped aggregates | `src/database.test.ts`, `src/sqliteQueries.spec.ts` |
| Commit/rollback transactions with nested reuse, context guards, query serialization and safe settlement | `src/databaseTransaction.spec.ts`, `src/sqliteTransaction.spec.ts`, `src/internal/transaction.test.ts` |
| Reusable Streams, incremental root reads and buffered transaction reads | `src/internal/relation.spec.ts`, `src/internal/transactionConcurrency.spec.ts`, database transaction suites |
| Typed query failures and preservation of unknown rejections as defects | `src/database.test.ts`, `src/sqlite.test.ts`, `src/internal/relation.spec.ts` |
| PostgreSQL timestamp declarations normalized to Date without overwriting unsupported forms | `src/bin/normalize-contract.test.ts`, `src/database.test.ts`, compiler tests |
| File-backed SQLite facade, WAL setup, UTC datetime decoding and coordinated query/transaction access | `src/sqlite.test.ts`, `src/sqliteIsolation.spec.ts`, `src/internal/sqlite-datetime.test.ts` |
| Rollback-only transaction primitive and Vitest facade built on effect-test | `src/databaseTesting.spec.ts`, `src/sqliteTesting.spec.ts`, `src/sqliteIsolation.spec.ts` |

SQLite remains experimental. PostgreSQL tests require `PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL`; a skipped PostgreSQL suite establishes no PostgreSQL behavior. Compiler tests cover cursor/distinct/distinct-on and single-row mutation types without establishing their runtime result semantics.

## Next

The repository does not name a next package implementation milestone. Before expanding the facade or promoting a backend, the maintainer needs to choose the intended support scope below. Framework adoption is separate work, tracked in the framework roadmap.

The existing compatibility boundary is narrow: maintain the generated-contract adaptation, transaction ownership and rollback test path without making native SQL applications depend on Prisma Next.

## Open questions

- How much ongoing Prisma Next feature work should this compatibility path receive alongside `effect-sql`? Keeping it maintained, freezing its feature scope and expanding toward upstream parity are different commitments; the repository has not chosen between them.
- What evidence and consumer need would promote SQLite beyond experimental support? The current facade has file-backed integration tests and coordination within one Layer, but no commitment to multi-client coordination or broader deployment guarantees.
- Should model variants and the other excluded Prisma Next collection operations ever join this facade? The draft design prefers exact types and transaction semantics over feature breadth; the maintainer owns whether broader parity is a goal.
