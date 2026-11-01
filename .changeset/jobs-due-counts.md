---
"@shivaedev/jobs": minor
---

### Added

- Expose `retryCount` and `deferralCount` on queue handlers' `JobContext` so `RetryAt` backoff can grow without application storage.
- Add `makePgBossTesting().runDueNow(queue)` to make delayed sends, native retries and deferrals due now and wake local workers. `waitForIdle` excludes future jobs.

### Breaking

- Queue handlers read Platform's durable deferral counter before each attempt, including handlers that never defer. If a deployment uses `migrate: false` with only pg-boss's native schema installed, run `installPgBossSchema` or apply the `pgBossSchema` migration component before starting its workers.
