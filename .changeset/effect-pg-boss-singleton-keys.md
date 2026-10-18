---
"@shivaedev/effect-pg-boss": minor
---

### Added

- Export `QueuePolicy` as the pinned pg-boss policy literals. Singleton queue definitions require `key: (payload) => string`, evaluated from the decoded payload when enqueueing. Related tagged-union job kinds can share one entity key: PostgreSQL allows one active job per key, other keys can run in parallel, and jobs waiting to retry or sent to the dead-letter queue leave the key available. Singleton does not guarantee ordering; applications keep handlers idempotent and guard writes against stale sources.

### Breaking

- `defineQueue` rejects unknown policy strings and requires `key` for `queue.policy: "singleton"`. Move per-job `singletonKey` options into the queue definition's key callback and remove them from `enqueue` calls for singleton queues. Ordinary queues retain native send options. Let `enqueue` infer its type arguments, or supply the queue-definition type as its third type argument in explicit generic calls.
