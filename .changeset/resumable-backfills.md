---
"@shivaedev/sql": minor
---

### Added

- `backfillPostgres` processes bounded batches in separate commit-bound transactions, saving application-owned progress with each batch so interrupted runs can resume outside the numbered migration ledger.
