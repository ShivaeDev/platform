# Roadmap

## Built

- [x] A Prisma Classic/PostgreSQL binding over effect-changes, with typed model mappings, a scoped `Client`, `use` and an explicit `recordWrite` seam.
- [x] Publication after a successful COMMIT, discard after rollback or failed commit, nested savepoint merge and discard, and publication when COMMIT lands after caller interruption.
- [x] `TransactionExpired` and body interruption at an explicit or configured wall-clock timeout, including linked nested bodies and queries that find a transaction closed. A transaction unable to start remains a `PrismaError`.
- [x] Row-based recording, keyed deduplication, autocommit publication, explicit batches, and unnamed-write reporting for count-only writes and returned rows missing a mapping field.
- [x] Table/model extraction from schema text, PostgreSQL transaction-counter baselines, and a table-level coverage check over recorded observations and unnamed writes.
- [x] Pure, type and real PostgreSQL tests, plus a packed-consumer fixture for published module imports and basic execution. PostgreSQL tests skip without `PLATFORM_EFFECT_CHANGES_PRISMA_TEST_DATABASE_URL`.

## Next

No package implementation milestone has been selected. The next extension should come from a demonstrated Prisma consumer and a decision about the open questions below. Cross-package adoption, composed application validation and deployment delivery policy belong in the [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md).

## Open questions

- How much independent support should this Prisma path receive as the framework's native persistence path develops? It serves Prisma applications; there is no decision here to replace it or retire it.
- Should recording stay at returned top-level model writes, with explicit `recordWrite` and coverage for other paths, or should the adapter observe more ORM behavior? Nested relation writes, cascades and trigger writes need dedicated tests before their coverage behavior is documented.
- Is table-level coverage the intended acceptance bar, or does a consumer need a check that proves every affected subject has a change?
- Should `recording.ts`, `expiry.ts`, `transaction.ts` and the interpretation helpers remain supported extension points? The module export pattern exposes them, while the primary usage path goes through `changes.ts`, `model.ts`, `write.ts`, `coverage.ts`, `tables.ts` and `error.ts`.
- Which PostgreSQL coverage edges need a supported contract: writes followed by TRUNCATE, or identical table names in several schemas? Dedicated tests are needed before either behavior can be promised.
