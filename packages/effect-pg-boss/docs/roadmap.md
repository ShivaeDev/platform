# Roadmap

This file owns the package's implementation inventory and open API choices. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md#next-application-and-deployment-acceptance) owns jobs integration with application services and external providers, including deployment and device validation.

## Built

- [x] `makePgBoss` retains its literal service identity in `PgBossDefinition` and its Layer type, so a different jobs Layer does not satisfy the required service. [Compiler evidence](https://github.com/ShivaeDev/platform/blob/main/packages/effect-pg-boss/src/service.typecheck.test.ts).
- [x] Object payload Schema definitions, decoded enqueue types and queue workers. Type tests reject primitive schemas, missing fields and encoded values passed as decoded payloads.
- [x] Encoding at enqueue and decoding before the handler. The PostgreSQL test round-trips a transformed payload and checks that malformed stored data reaches the dead-letter queue without calling the domain handler.
- [x] Queue and schedule registration, with dead-letter queues, default retry settings and UTC schedule registration. Fake-client tests verify the supplied settings and a retry-limit override.
- [x] Producer-only queue definitions create queues and dead-letter queues through `Jobs.layer({ jobs: [Queue] })`, without starting a consumer. The [PostgreSQL producer test](../src/server/producerPostgres.spec.ts) enqueues a transformed payload and observes worker retry exhaustion and dead-letter delivery. The [starter producer](../../../examples/starter/src/server/noteProducer.ts) uses this API.
- [x] Native pg-boss burst defaults (`batchSize: 10`, `burstWhenBatchFull: true`) and configurable batches and local concurrency. [PostgreSQL backlog evidence](../src/server/throughputPostgres.spec.ts) drains 30 jobs within 2.5 seconds.
- [x] Handlers and scheduled effects can yield their owning jobs service without an external self requirement. [PostgreSQL follow-up evidence](../src/server/followUpPostgres.spec.ts) completes a worker chain and enqueues to a producer-only queue using one scoped client. All declared queues exist before consumers start.
- [x] Worker and scheduled Effect service capture. Runtime and packed-consumer type tests preserve handler requirements.
- [x] Scoped startup and shutdown, including cleanup when startup or registration fails.
- [x] Explicit keyed client reuse and unkeyed per-build acquisition. Lifecycle tests cover two builds sharing one client and replacing the registered worker.
- [x] Full pg-boss queue creation options, excluding the adapter's name and dead-letter setup. [PostgreSQL evidence](../src/server/notifyPostgres.spec.ts) verifies notification delivery to a waiting worker and immediate live counts after completion; [type tests](../src/server/service.typecheck.test.ts) enforce option ownership.
- [x] Schema-decoded lookup by job ID and retry under the same ID for failed or retry-waiting jobs. [PostgreSQL evidence](../src/server/jobControlPostgres.spec.ts) verifies both states complete after a manual retry.
- [x] Startup reconciles declared mutable queue settings and rejects immutable policy or partition changes with a typed error. [PostgreSQL restart evidence](../src/server/queueOptionsPostgres.spec.ts) checks expiry and retry-limit changes on an existing queue.
- [x] Queue health totals for active, failed, queued, ready and dead-lettered counts, verified with a populated fake queue.
- [x] Public defining-module imports and an installed-package type fixture.

## Next

No further package API expansion is selected. Let the framework's jobs integration work identify the next package change, and preserve the existing payload and lifecycle contracts while it does. That integration's status stays in the framework roadmap.

## Decisions

Enqueueing is separate from application SQL transactions. The package supplies no transactional enqueue adapter. Applications use transactions for database invariants and handle queue errors without failing those transactions. The starter enqueues after its note write transaction and logs queue failures; its [PostgreSQL queue-failure story](../../../examples/starter/src/server/queueFailure.spec.ts) proves that rejected enqueueing leaves create and edit writes saved. Its [rollback story](../../../examples/starter/src/server/committedJobs.spec.ts) also proves that an independently enqueued job survives an outer application rollback.

## Open questions

- Should a shared client key be checked against constructor settings and registration changes? The lifecycle fixture uses the same Layer twice; it does not settle incompatible configurations under one key.
- Which public hooks need dedicated regression coverage before the guide makes stronger claims? Error-event reporting, cancellation through a job's AbortSignal, a declined send result, multi-queue health and actual cron execution are implemented boundaries or engine behaviors without focused evidence here.
