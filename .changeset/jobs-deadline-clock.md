---
"@shivaedev/jobs": minor
---

### Fixed

- Measure claimed-job expiry, remaining budgets and interrupted-batch settlement waits against PostgreSQL time, independent of the runtime clock's date.
- Include the original failure's tag and redacted message in settle errors.

### Breaking

- Worker clients must expose `getDb()` so jobs can read their PostgreSQL clock once per batch. Custom client factories must supply it; producer-only clients are unchanged.
- `jobContext(job, deadline)` now requires a deadline in runtime Clock milliseconds. Callers constructing contexts must first measure the remaining expiry against the database clock, then add that duration to the runtime Clock time.
