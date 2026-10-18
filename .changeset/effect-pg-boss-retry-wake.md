---
"@shivaedev/effect-pg-boss": patch
---

### Fixed

- Wake workers when a failed job's retry delay ends instead of waiting for the polling backstop, including idle siblings when another worker in a concurrent registration is busy. Pending wakes are canceled when the worker Layer's scope closes. Custom clients can supply the optional `PgBossClient.notifyWorker` method to enable retry wakes and `PgBossClient.getWipData` to wake every native worker in the registration.
