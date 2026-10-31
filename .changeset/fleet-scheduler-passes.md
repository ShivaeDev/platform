---
"@shivaedev/work-fleet": minor
---

### Added

- `healthLayer` also provides `SchedulerPasses` from `@shivaedev/work-fleet/engine/health.ts`, a `SubscriptionRef` that counts the scheduler passes the runtime has completed, so a waiter can wait for the next pass instead of sleeping through an interval.
