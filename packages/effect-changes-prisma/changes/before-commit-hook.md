### Fixed

- `beforeCommit` now runs for Prisma transactions. A hook failure rolls back the write and publishes nothing.
