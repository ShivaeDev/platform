---
"@shivaedev/jobs": minor
---

### Breaking

- Queue and scheduled workers now fail Layer acquisition with a registration `PgBossError` when `worker.perJobResults` or `worker.transactional` is `true`. Omit these options or set them to `false`; the adapter owns per-job settlement and does not pass a pg-boss transaction client to handlers. Consumers needing pg-boss's result-array or transactional callback contracts must register those workers through pg-boss directly.
