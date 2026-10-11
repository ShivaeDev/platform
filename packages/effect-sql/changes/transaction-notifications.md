### Added

- `postgresChanges` in `postgresChanges.ts` binds `transact` to PostgreSQL LISTEN/NOTIFY using the writing transaction's SQL client. Each process delivers committed string or finite-number invalidation keys into local Reactivity. Rollback sends no notification.
- The scoped listener uses a heartbeat to detect silent connection loss, resyncs live streams on loss and recovery, and retries with a fresh subscription. UTF-8 payloads are split below PostgreSQL's 8,000-byte NOTIFY limit; an oversized individual key or unsupported key rolls back the transaction.
- `BeforeCommit` and `CommittedSink` in `transact.ts` expose the SQL channel's binding seams.
