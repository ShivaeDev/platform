### Fixed

- `beforeCommit` now runs for Prisma transactions with the transaction's scoped client. Hook reads see uncommitted body rows, and a hook failure rolls back body and hook writes and publishes nothing.
