# Changelog

## Unreleased

## 0.4.3 - 2026-08-03

### Fixed

- Normalize PostgreSQL timestamp types emitted through Prisma Next's codec
  references to `Date`.

## 0.4.2 - 2026-08-03

### Fixed

- Provide a contract-normalization command that corrects Prisma Next's
  PostgreSQL timestamp declarations without recursively expanding large client
  types.

## 0.4.1 - 2026-08-03

### Fixed

- Expose PostgreSQL timestamp and timestamp-with-time-zone fields as `Date`,
  matching Prisma Next's runtime codecs even when its generated contract renders
  those fields as branded strings.

## 0.4.0 - 2026-08-03

### Added

- Export database definition helpers and Prisma Next boolean filter
  combinators for higher-level integrations.

## 0.3.0 - 2026-08-03

### Added

- Export database service and requirement types from the testing entrypoint for
  higher-level test harnesses.

### Changed

- Serialize queries sharing a transaction connection, and buffer
  transaction-scoped Streams before downstream processing. Queries and Streams
  outside transactions remain parallel and incremental.
- Target Effect 4.0.0-beta.102 across the runtime and optional Vitest helpers.

## 0.2.0 - 2026-07-26

### Added

- Load typed to-one and to-many relations, including nested and refined
  relations and relation counts.
- Count any filtered relation directly without building an aggregate result.

## 0.1.0 - 2026-07-26

### Added

- Effect-native, immutable Prisma relations with typed filtering, ordering,
  pagination, aggregates, grouping, and mutation operations.
- Implicitly scoped transactions that preserve the same database service inside
  and outside a transaction.
- Vitest helpers for typed database tests that automatically roll back their
  changes.
