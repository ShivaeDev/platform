---
"@shivaedev/effect-pg-boss": minor
---

### Added

- Fail a queue or scheduled handler with `RetryAt({ at, reason })` from `definition.ts` to defer the same job until a UTC time without spending a retry, changing its payload or singleton key, or calling `onError`. A deferred attempt ends its span OK with a `job.deferred` event. The exported `QueueOptions` type adds `maxDeferrals`, and queue and schedule definitions expose its resolved value. `queue.maxDeferrals` defaults to 10 per job; subsequent deferrals fail normally. Deferred jobs use the polling backstop, including with `notify: true`.
- Inspect waiting deferrals with the testing controller's `deferred(queue)`, returning `{ at, reason }[]`, and pull them forward with `runDeferredNow(queue)`. Both integrate with the controller's revision and change notification controls.
- Deferral counts survive native expiry and heartbeat failures. Automatic migrations and `installPgBossSchema` install the adapter's durable counter table alongside the pg-boss schema.
- Stately jobs sharing a singleton key can defer together without colliding or spending retries, and resume one at a time. Waiting deferrals use the `effect-stately-deferred` policy in native job metadata; an adapter-installed database trigger restores `stately` when claimed.
