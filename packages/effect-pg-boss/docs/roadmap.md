# Roadmap

This file owns the package's implementation inventory and open API choices. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md#next-application-and-deployment-acceptance) owns jobs integration with application services and external providers, including deployment and device validation.

## Built

- [x] Object payload Schema definitions, decoded enqueue types and queue workers. Type tests reject primitive schemas, missing fields and encoded values passed as decoded payloads.
- [x] Encoding at enqueue and decoding before the handler. The PostgreSQL test round-trips a transformed payload and checks that malformed stored data reaches the dead-letter queue without calling the domain handler.
- [x] Queue and schedule registration, with dead-letter queues, default retry settings and UTC schedule registration. Fake-client tests verify the supplied settings and a retry-limit override.
- [x] Worker and scheduled Effect service capture. Runtime and packed-consumer type tests preserve handler requirements.
- [x] Scoped startup and shutdown, including cleanup when startup or registration fails.
- [x] Explicit keyed client reuse and unkeyed per-build acquisition. Lifecycle tests cover two builds sharing one client and replacing the registered worker.
- [x] Queue health totals for active, failed, queued, ready and dead-lettered counts, verified with a populated fake queue.
- [x] Public defining-module imports and an installed-package type fixture.

## Next

No further package API expansion is selected. Let the framework's jobs integration work identify the next package change, and preserve the existing payload and lifecycle contracts while it does. That integration's status stays in the framework roadmap.

## Open questions

- Which application boundary should choose how a database write becomes a durable job: an explicit after-commit action, an outbox, or another demonstrated approach? The enqueue API is independent of application SQL; no transaction coupling is selected.
- Should a shared client key be checked against constructor settings and registration changes? The lifecycle fixture uses the same Layer twice; it does not settle incompatible configurations under one key.
- Which public hooks need dedicated regression coverage before the guide makes stronger claims? Error-event reporting, cancellation through a job's AbortSignal, a declined send result, multi-queue health and actual cron/retry execution are implemented boundaries or engine behaviors without focused evidence here.
- Should the package grow only when an application's integration needs a helper, or is a wider jobs API intended? The package has no in-repo application consumer to settle that question.
