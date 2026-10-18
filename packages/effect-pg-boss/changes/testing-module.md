### Added

- Export `testing.ts` with `makePgBossTesting`, `testRetryPolicy`, `PgBossTesting` and `PgBossTestingOptions`, plus `PgBossTestingError` from `error.ts`. Story kits can read Schema-decoded jobs, fail the next send, expire a selected attempt, set immediate retries, check batch budgets and schema versions, and wait for local queue changes or worker idleness without application SQL or timer polling.
