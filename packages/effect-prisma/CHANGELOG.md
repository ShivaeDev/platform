# Changelog

## Unreleased

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
