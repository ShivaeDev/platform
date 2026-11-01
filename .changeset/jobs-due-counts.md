---
"@shivaedev/jobs": minor
---

### Added

- Expose `retryCount` and `deferralCount` on queue handlers' `JobContext` so `RetryAt` backoff can grow without application storage.
- Add `makePgBossTesting().runDueNow(queue)` to make delayed sends, native retries and deferrals due now and wake local workers. `waitForIdle` excludes future jobs.
