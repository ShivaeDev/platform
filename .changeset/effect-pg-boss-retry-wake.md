---
"@shivaedev/effect-pg-boss": patch
---

### Fixed

- Wake workers when a failed job's retry delay ends instead of waiting for the polling backstop. Pending wakes are canceled when the worker Layer's scope closes. Custom clients can supply the optional `PgBossClient.notifyWorker` method to enable retry wakes.
