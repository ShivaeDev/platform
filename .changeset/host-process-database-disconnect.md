---
"@shivaedev/test-kits": minor
---

### Breaking

- `hostProcess()` no longer returns `disconnectIdlePostgres()`, and a `databaseUrl` now reaches the child's `DATABASE_URL` directly instead of through a disconnect proxy. Delete the stories that call `disconnectIdlePostgres()`; database outages are not a tested scenario.
